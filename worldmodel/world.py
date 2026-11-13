# A ball on a spring, centred at (5, 5). No walls or bounces, so every error comes from the rules.
# The "rules" (gravity, wind, spring stiffness, drag) can change without warning.
import numpy as np

REGIMES = {
    "A: normal gravity":              dict(g=-5.0, wind=0.0,  k=2.0, drag=0.1),
    "B: low gravity, wind":           dict(g=-1.0, wind=3.0,  k=2.0, drag=0.1),
    "C: upside-down, stiff, draggy":  dict(g=4.0,  wind=-2.0, k=6.0, drag=0.8),
}
DT, SIZE, CENTRE = 0.05, 10.0, 5.0

def step(s, r):
    x, y, vx, vy = s
    ax = r["wind"] - r["k"] * (x - CENTRE) - r["drag"] * vx
    ay = r["g"]    - r["k"] * (y - CENTRE) - r["drag"] * vy
    vx += ax * DT; vy += ay * DT
    x += vx * DT; y += vy * DT
    return np.array([x, y, vx, vy])

def random_state(rng):
    return np.array([rng.uniform(2, 8), rng.uniform(2, 8), rng.uniform(-4, 4), rng.uniform(-4, 4)])

NOISE = np.array([0.01, 0.01, 0.03, 0.03])   # sensor noise: 1 cm on position, 3 cm/s on speed

def stream(schedule, seed=0, reset_every=150):
    """Yields (observed state, observed next state, regime_name) following a schedule of
    (regime, steps). Observations carry sensor noise; the true state evolves underneath."""
    rng = np.random.default_rng(seed); t = 0
    seen = lambda x: x + rng.normal(0, NOISE)
    for name, n in schedule:
        for _ in range(n):
            if t % reset_every == 0: s = random_state(rng); o = seen(s)
            s2 = step(s, REGIMES[name]); o2 = seen(s2)
            yield o, o2, name; s, o = s2, o2; t += 1
