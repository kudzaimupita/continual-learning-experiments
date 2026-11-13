import json, sys, time
import numpy as np
sys.path.insert(0, ".")
from world import stream
from learners import Frozen, Naive, Replay, Library, pretrain, error, errors_many

A, B, C = "A: normal gravity", "B: low gravity, wind", "C: upside-down, stiff, draggy"
SCHEDULE = [(A, 1500), (B, 1500), (A, 1500), (C, 1500), (B, 1000)]

t0 = time.time()
pre = [(s, s2) for s, s2, _ in stream([(A, 4000)], seed=99)]
base = pretrain(pre)
held = [(s, s2) for s, s2, _ in stream([(A, 1000)], seed=7)]
baseline = errors_many(base, held)
print(f"pretrained on A in {time.time()-t0:.0f}s, baseline error on new A data {baseline:.3f}", flush=True)

learners = [Frozen(base), Naive(base), Replay(base), Library(base, baseline)]
data = list(stream(SCHEDULE, seed=1))
errs = {L.name: [] for L in learners}
for i, (s, s2, _) in enumerate(data):
    for L in learners:
        errs[L.name].append(error(L.predict(s), s2))   # predict BEFORE seeing the outcome
        L.observe(s, s2)
    if (i + 1) % 1000 == 0: print(f"step {i+1}/{len(data)} ({time.time()-t0:.0f}s)", flush=True)

# Final exam: how well does each learner know every rule set at the end? (fresh data)
final = {}
for L in learners:
    final[L.name] = {}
    for R in (A, B, C):
        test = [(s, s2) for s, s2, _ in stream([(R, 600)], seed=123)]
        nets = [e["net"] for e in L.experts] if hasattr(L, "experts") else [L.net]
        final[L.name][R] = min(errors_many(n, test) for n in nets) / baseline   # library uses its best-matching expert
    print(f"final exam {L.name}: " + ", ".join(f"{R.split(':')[0]} {v:.1f}x" for R, v in final[L.name].items()), flush=True)
lib = learners[-1]
json.dump({"baseline": baseline, "schedule": SCHEDULE, "errors": errs,
           "library_events": lib.log, "library_experts": len(lib.experts), "final": final},
          open("results.json", "w"))
print("spawns (expert, step, error vs baseline):", [e[1:] for e in lib.log if e[0]=="spawn"]); print("switches (expert, step):", [e[1:] for e in lib.log if e[0]=="switch"])
