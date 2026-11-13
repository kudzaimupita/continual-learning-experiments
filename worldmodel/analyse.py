import json, numpy as np
r = json.load(open("results.json")); base = r["baseline"]
bounds = np.cumsum([0] + [n for _, n in r["schedule"]])
labels = [f"{i+1}. {name.split(':')[0]}" for i, (name, _) in enumerate(r["schedule"])]
def roll(x, k=50): return np.convolve(x, np.ones(k) / k, mode="valid")
rows = {}
for name, e in r["errors"].items():
    e = np.array(e) / base; phase = [e[bounds[i]:bounds[i+1]].mean() for i in range(len(labels))]
    rec = []
    for i in range(1, len(labels)):
        seg = roll(e[bounds[i]:bounds[i+1]]); hit = np.where(seg < 3)[0]
        rec.append(int(hit[0]) if len(hit) else None)
    back_a = e[bounds[2]:bounds[2] + 100].mean(); back_b = e[bounds[4]:bounds[4] + 100].mean()
    rows[name] = dict(phase=phase, recover=rec, back_a=back_a, back_b=back_b)
    print(name)
    print("   mean error per phase:", " | ".join(f"{l} {p:.1f}" for l, p in zip(labels, phase)))
    print("   steps to recover (rolling-50 < 3x baseline):", rec)
    print(f"   first 100 steps back in A: {back_a:.1f}   back in B: {back_b:.1f}")
print("errors are multiples of the pretrained model's error on rule set A; baseline", round(base, 3), "experts", r["library_experts"])
json.dump(rows, open("summary.json", "w"), indent=1)
