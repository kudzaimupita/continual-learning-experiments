import json, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

r = json.load(open("results.json")); base = r["baseline"]
INK, MUTED, GRID, SURF, BAND = "#1c1c1a", "#6b6b66", "#e4e4e0", "#fcfcfb", "#f0efeb"
BLUE, SERIES = "#2a78d6", ["#2a78d6", "#eb6834", "#1baf7a"]
plt.rcParams.update({"font.family": "Helvetica Neue", "font.size": 10, "axes.edgecolor": GRID,
                     "axes.labelcolor": MUTED, "xtick.color": MUTED, "ytick.color": MUTED,
                     "figure.facecolor": SURF, "axes.facecolor": SURF})
bounds = np.cumsum([0] + [n for _, n in r["schedule"]])
names = [n.split(":")[0] for n, _ in r["schedule"]]
full = {"A": "A  normal gravity", "B": "B  low gravity, wind", "C": "C  upside-down, stiff, draggy"}

# 1) prediction error over time, one panel per learner
fig, axes = plt.subplots(4, 1, figsize=(11, 9), sharex=True, sharey=True)
k = 25
for ax, (name, e) in zip(axes, r["errors"].items()):
    e = np.array(e) / base
    sm = np.convolve(e, np.ones(k) / k, mode="valid")
    for i in range(len(names)):
        if i % 2 == 0: ax.axvspan(bounds[i], bounds[i + 1], color=BAND, lw=0)
    ax.axhline(1, color=MUTED, lw=0.8, ls=(0, (3, 3)))
    ax.plot(np.arange(k - 1, len(e)), sm, color=BLUE, lw=1.6)
    ax.set_yscale("log"); ax.set_ylim(0.5, 400)
    ax.set_yticks([1, 3, 10, 30]); ax.set_yticklabels(["1x", "3x", "10x", "30x"])
    ax.set_title(name, loc="left", fontsize=10.5, color=INK, fontweight="bold", pad=4)
    for s in ("top", "right"): ax.spines[s].set_visible(False)
    ax.tick_params(length=0); ax.grid(axis="y", color=GRID, lw=0.6)
    if name.startswith("Expert"):
        for ev in r["library_events"]:
            x = ev[2]; txt = f"new expert {ev[1]}" if ev[0] == "spawn" else f"back to expert {ev[1]}"
            ax.axvline(x, color=INK, lw=0.8)
            ax.text(x + 40, 60, txt, fontsize=8.5, color=INK, va="center")
for i, n in enumerate(names):
    for ax in axes:
        ax.text((bounds[i] + bounds[i + 1]) / 2, 220, f"Rules {n}", ha="center", fontsize=8.5, color=MUTED)
axes[-1].set_xlabel("time step")
fig.supylabel("prediction error vs. normal (log scale, 25-step average)", color=MUTED, fontsize=9.5)
fig.suptitle("Predict, check, adapt: which learner keeps up when the rules change?", x=0.06, ha="left",
             fontsize=13, color=INK, fontweight="bold", y=0.995)
fig.tight_layout(rect=(0.01, 0, 1, 0.965)); fig.savefig("error.png", dpi=150)

# 2) final exam on every rule set
fig, ax = plt.subplots(figsize=(9, 4.2))
learners = list(r["final"]); regs = list(r["final"][learners[0]])
w = 0.24; x = np.arange(len(learners))
for j, R in enumerate(regs):
    v = [r["final"][L][R] for L in learners]
    bars = ax.bar(x + (j - 1) * (w + 0.02), v, w, color=SERIES[j], label=full[R.split(":")[0]], edgecolor=SURF, linewidth=1)
    for xi, vi in zip(x + (j - 1) * (w + 0.02), v):
        ax.text(xi, vi * 1.12, f"{vi:.1f}x", ha="center", fontsize=8, color=INK)
ax.set_yscale("log"); ax.set_ylim(0.5, 80); ax.set_yticks([1, 3, 10, 30]); ax.set_yticklabels(["1x", "3x", "10x", "30x"])
ax.axhline(1, color=MUTED, lw=0.8, ls=(0, (3, 3)))
ax.set_xticks(x); ax.set_xticklabels([L.split(" (")[0] for L in learners], color=INK)
for s in ("top", "right"): ax.spines[s].set_visible(False)
ax.tick_params(length=0); ax.grid(axis="y", color=GRID, lw=0.6); ax.set_axisbelow(True)
ax.set_ylabel("error vs. normal (lower is better)")
ax.legend(frameon=False, fontsize=9, loc="upper left", ncol=3, bbox_to_anchor=(0, 1.02))
ax.set_title("Final exam after all 7,000 steps: does it still know every rule set?", loc="left", fontsize=12,
             color=INK, fontweight="bold", pad=24)
fig.tight_layout(); fig.savefig("final-exam.png", dpi=150)
print("saved")
