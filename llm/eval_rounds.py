import sys, json
from common import load_model, ask, hit
from towns import TOWNS
from general import GENERAL_TEST
adapter, upto = sys.argv[1], int(sys.argv[2])
model, tok = load_model(adapter)
per_town, misses = [], []
for t in TOWNS[:upto]:
    ok = 0
    for f in t["facts"]:
        a = ask(model, tok, f["test"], max_tokens=40)
        if hit(a, [f["kw"]]): ok += 1
        else: misses.append((f["test"], a[:80]))
    per_town.append(ok)
gen = 0; gen_miss = []
for q, kw in GENERAL_TEST:
    a = ask(model, tok, q, max_tokens=40)
    if hit(a, kw): gen += 1
    else: gen_miss.append((q, a[:80]))
print(json.dumps({"per_town": per_town, "general": gen, "fact_misses": misses, "general_misses": gen_miss}))
