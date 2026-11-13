# A ball in a 10x10 box. The "rules" (gravity, wind, bounciness) can change.
import numpy as np

REGIMES = {
    "A: normal gravity":          dict(g=-9.8, wind=0.0,  bounce=0.9),
    "B: low gravity, wind":       dict(g=-3.0, wind=4.0,  bounce=0.9),
    "C: upside-down, dead bounce": dict(g=6.0,  wind=-2.0, bounce=0.5),
}
DT, SIZE = 0.05, 10.0

def step(s, r):
    x, y, vx, vy = s
    vx += r["wind"] * DT; vy += r["g"] * DT
    x += vx * DT; y += vy * DT
    if x < 0: x, vx = -x, -vx * r["bounce"]
    if x > SIZE: x, vx = 2 * SIZE - x, -vx * r["bounce"]
    if y < 0: y, vy = -y, -vy * r["bounce"]
    if y > SIZE: y, vy = 2 * SIZE - y, -vy * r["bounce"]
    return np.array([x, y, np.clip(vx, -15, 15), np.clip(vy, -15, 15)])

def random_state(rng):
    return np.array([rng.uniform(1, 9), rng.uniform(1, 9), rng.uniform(-5, 5), rng.uniform(-5, 5)])

def stream(schedule, seed=0, reset_every=150):
    """Yields (state, next_state, regime_name) following a schedule of (regime, steps)."""
    rng = np.random.default_rng(seed); s = random_state(rng); t = 0
    for name, n in schedule:
        for _ in range(n):
            if t % reset_every == 0: s = random_state(rng)
            s2 = step(s, REGIMES[name]); yield s, s2, name; s = s2; t += 1
