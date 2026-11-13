import json, os
from common import load_model, ask
from facts import FACTS
from general import REPLAY

msg = lambda q, a: {"messages": [{"role": "user", "content": q}, {"role": "assistant", "content": a}]}
fact_rows = [msg(q, ans) for ans, _, train_qs, _ in FACTS for q in train_qs]

model, tok = load_model()
replay_rows = [msg(q, ask(model, tok, q, max_tokens=120)) for q in REPLAY]

os.makedirs("data-v2", exist_ok=True)
train = fact_rows + replay_rows * 2
valid = fact_rows[::15]
import random; random.Random(0).shuffle(train)
for name, rows in [("train", train), ("valid", valid)]:
    with open(f"data-v2/{name}.jsonl", "w") as f:
        for r in rows: f.write(json.dumps(r) + "\n")
print(f"train {len(train)} rows ({len(fact_rows)} facts + 60 replay), valid {len(valid)} rows")
print("sample replay:", replay_rows[0]["messages"][1]["content"][:120])
