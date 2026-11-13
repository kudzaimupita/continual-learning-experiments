# Learners that predict the next moment, then see what really happened, then adapt.
import random
import numpy as np
import mlx.core as mx
import mlx.nn as nn
import mlx.optimizers as optim
from mlx.utils import tree_map

ONLINE_LR = 3e-4                        # live learning rate (pretraining uses 1e-3)
mx.set_default_device(mx.cpu)          # tiny nets; keeps the GPU free for other jobs
SCALE = np.array([10.0, 10.0, 15.0, 15.0], dtype=np.float32)
OUT = 10.0                              # target = (next - now) in normalized units, times OUT

def norm(s): return (np.asarray(s, dtype=np.float32) / SCALE)

class MLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.l1, self.l2, self.l3 = nn.Linear(4, 64), nn.Linear(64, 64), nn.Linear(64, 4)
    def __call__(self, x):
        return self.l3(nn.silu(self.l2(nn.silu(self.l1(x)))))

def loss_fn(model, x, y): return mx.mean((model(x) - y) ** 2)

class Net:
    """One world model plus its optimizer."""
    def __init__(self, lr=ONLINE_LR, copy_from=None):
        self.model = MLP()
        if copy_from is not None:
            self.model.update(tree_map(lambda a: mx.array(np.array(a)), copy_from.model.parameters()))
        mx.eval(self.model.parameters())
        self.opt = optim.Adam(learning_rate=lr)
        self.grad = nn.value_and_grad(self.model, loss_fn)
    def predict_many(self, S):          # S: (n,4) raw states -> (n,4) normalized next states
        x = norm(S); d = np.array(self.model(mx.array(x))) / OUT
        return x + d
    def train(self, batch):             # batch: list of (s, s2)
        S = np.stack([b[0] for b in batch]); S2 = np.stack([b[1] for b in batch])
        x = norm(S); y = (norm(S2) - x) * OUT
        l, g = self.grad(self.model, mx.array(x), mx.array(y))
        self.opt.update(self.model, g); mx.eval(self.model.parameters(), self.opt.state)
        return l.item()

def error(pred_norm, s2):               # squared error in normalized state units, x1000
    return float(np.mean((pred_norm - norm(s2)) ** 2) * 1000)

def errors_many(net, batch):
    S = np.stack([b[0] for b in batch]); S2 = np.stack([b[1] for b in batch])
    return float(np.mean((net.predict_many(S) - norm(S2)) ** 2) * 1000)

def pretrain(data, steps=3000, batch=64, seed=0):
    rng = random.Random(seed); net = Net(lr=1e-3)
    for _ in range(steps): net.train(rng.sample(data, batch))
    return net

# ---- learners: predict(s) -> normalized next state; observe(s, s2) adapts ----
class Frozen:
    name = "Frozen (never adapts)"
    def __init__(self, base): self.net = Net(lr=ONLINE_LR, copy_from=base)
    def predict(self, s): return self.net.predict_many(s[None])[0]
    def observe(self, s, s2): pass

class Naive:
    name = "Naive online (recent only)"
    def __init__(self, base): self.net = Net(lr=ONLINE_LR, copy_from=base); self.recent = []
    def predict(self, s): return self.net.predict_many(s[None])[0]
    def observe(self, s, s2):
        self.recent = (self.recent + [(s, s2)])[-32:]
        self.net.train(self.recent)

class Replay:
    name = "Replay (recent + memory)"
    def __init__(self, base, cap=5000, seed=1):
        self.net = Net(lr=ONLINE_LR, copy_from=base); self.recent = []; self.memory = []; self.seen = 0
        self.cap = cap; self.rng = random.Random(seed)
    def predict(self, s): return self.net.predict_many(s[None])[0]
    def observe(self, s, s2):
        self.recent = (self.recent + [(s, s2)])[-16:]
        self.seen += 1                  # reservoir sampling keeps a fair sample of all history
        if len(self.memory) < self.cap: self.memory.append((s, s2))
        else:
            j = self.rng.randrange(self.seen)
            if j < self.cap: self.memory[j] = (s, s2)
        batch = self.recent + self.rng.sample(self.memory, min(16, len(self.memory)))
        self.net.train(batch)

class Library:
    """Keeps one expert per set of rules. Each moment it predicts with the active expert,
    then checks how wrong it was. A surprising moment is never used to train the active
    expert, so a sudden rule change cannot corrupt it. If most recent moments are
    surprising, it first tries the other experts it already has; if none fits, it spawns a
    new expert for the new rules."""
    name = "Expert library (detect, switch, spawn)"
    WINDOW, SURPRISED_SHARE, PROBATION = 20, 0.75, 300
    def __init__(self, base, baseline, seed=2):
        self.experts = [dict(net=Net(lr=ONLINE_LR, copy_from=base), buf=[], age=10_000)]
        self.active = 0; self.recent = []; self.flags = []
        self.thresh = 6 * baseline; self.rng = random.Random(seed); self.log = []; self.t = 0
    def predict(self, s): return self.experts[self.active]["net"].predict_many(s[None])[0]
    def observe(self, s, s2):
        self.t += 1
        self.recent = (self.recent + [(s, s2)])[-self.WINDOW:]
        ex = self.experts[self.active]
        surprise = errors_many(ex["net"], [(s, s2)]) > self.thresh and ex["age"] >= self.PROBATION
        self.flags = (self.flags + [surprise])[-self.WINDOW:]
        if len(self.flags) == self.WINDOW and sum(self.flags) >= self.SURPRISED_SHARE * self.WINDOW:
            errs = [errors_many(e["net"], self.recent) for e in self.experts]
            best = int(np.argmin(errs))
            if best != self.active and errs[best] < self.thresh:     # an old expert fits: reuse it
                self.active = best; self.log.append(("switch", best, self.t))
            else:                                                    # nothing fits: new expert
                new = dict(net=Net(lr=ONLINE_LR, copy_from=self.experts[best]["net"]),
                           buf=list(self.recent), age=0)
                self.experts.append(new); self.active = len(self.experts) - 1
                self.log.append(("spawn", self.active, self.t, round(errs[best] / self.thresh * 6, 1)))
            self.flags = []; ex = self.experts[self.active]; surprise = False
        if not surprise:                # learn only from moments this expert can explain
            ex["buf"] = (ex["buf"] + [(s, s2)])[-3000:]
            ex["age"] += 1
            b = ex["buf"]; batch = b[-16:] + self.rng.sample(b, min(16, len(b)))
            ex["net"].train(batch)
