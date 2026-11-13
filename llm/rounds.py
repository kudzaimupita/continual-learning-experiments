# Sequential learning: one new town per round, adapter carried forward.
# usage: rounds.py METHOD [N_ROUNDS] [ITERS]   METHOD = naive | replay
import sys, json, os, random, subprocess, shutil
from towns import TOWNS
from general import GENERAL_TEST, REPLAY

method = sys.argv[1]
n_rounds = int(sys.argv[2]) if len(sys.argv) > 2 else 10
iters = int(sys.argv[3]) if len(sys.argv) > 3 else 100
start = int(sys.argv[4]) if len(sys.argv) > 4 else 1   # resume from this round, keeping earlier adapters
OLD_FACT_ROWS = 30          # replay method: old-fact rows mixed in per round
out = f"runs/{method}"
rng = random.Random(7 + start)
if start == 1:
    shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
else:
    for k in range(start, n_rounds + 1):
        shutil.rmtree(f"{out}/data-{k}", ignore_errors=True); shutil.rmtree(f"{out}/adapter-{k}", ignore_errors=True)

msg = lambda q, a: {"messages": [{"role": "user", "content": q}, {"role": "assistant", "content": a}]}
# general replay rows: the base model's own answers, built earlier by build_data_v2.py
general_rows = [json.loads(l) for l in open("data-v2/train.jsonl")]
general_rows = [r for r in general_rows if r["messages"][0]["content"] in REPLAY]
general_rows = list({r["messages"][0]["content"]: r for r in general_rows}.values())
assert len(general_rows) == len(REPLAY), len(general_rows)

def fact_rows(town):
    return [msg(q, f["answer"]) for f in town["facts"] for q in f["train"]]

log = json.load(open(f"{out}/log.json"))[:start - 1] if start > 1 else []
for r in range(start - 1, n_rounds):
    town = TOWNS[r]
    rows = fact_rows(town) + general_rows
    if method == "replay" and r > 0:
        old = [x for t in TOWNS[:r] for x in fact_rows(t)]
        rows += rng.sample(old, min(OLD_FACT_ROWS, len(old)))
    rng.shuffle(rows)
    d = f"{out}/data-{r+1}"; os.makedirs(d)
    with open(f"{d}/train.jsonl", "w") as f:
        for x in rows: f.write(json.dumps(x) + "\n")
    with open(f"{d}/valid.jsonl", "w") as f:
        for x in general_rows[:4]: f.write(json.dumps(x) + "\n")
    adapter = f"{out}/adapter-{r+1}"
    cfg = open("lora-v2.yaml").read()
    cfg = cfg.replace('data: "data-v2"', f'data: "{d}"').replace("iters: 200", f"iters: {iters}") \
             .replace('adapter_path: "adapters/v2"', f'adapter_path: "{adapter}"') \
             .replace("steps_per_eval: 100", f"steps_per_eval: {iters}").replace("save_every: 100", f"save_every: {iters}")
    if r > 0:
        cfg += f'resume_adapter_file: "{out}/adapter-{r}/adapters.safetensors"\n'
    open(f"{d}/lora.yaml", "w").write(cfg)
    res = subprocess.run([sys.executable, "-m", "mlx_lm", "lora", "-c", f"{d}/lora.yaml"],
                         capture_output=True, text=True)
    if res.returncode != 0:
        print(res.stdout[-2000:], res.stderr[-2000:]); sys.exit(1)

    ev = subprocess.run([sys.executable, "eval_rounds.py", adapter, str(r + 1)],
                        capture_output=True, text=True)
    if ev.returncode != 0:
        print(ev.stderr[-2000:]); sys.exit(1)
    row = json.loads(ev.stdout.strip().splitlines()[-1])
    row["round"] = r + 1; row["train_rows"] = len(rows)
    log.append(row)
    json.dump(log, open(f"{out}/log.json", "w"), indent=1)
    print(f"[{method}] round {r+1}: per-town {row['per_town']} | general {row['general']}/{len(GENERAL_TEST)}", flush=True)
