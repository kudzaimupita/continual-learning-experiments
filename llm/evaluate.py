import sys, json
from common import load_model, ask, hit
from facts import FACTS
from general import GENERAL_TEST

adapter = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != "none" else None
label = sys.argv[2] if len(sys.argv) > 2 else (adapter or "base")
model, tok = load_model(adapter)

def run(items):
    rows = []
    for q, kw in items:
        a = ask(model, tok, q)
        rows.append({"q": q, "a": a, "ok": hit(a, kw)})
    return rows

seen = run([(f[2][0], f[1]) for f in FACTS])      # a phrasing used in training
unseen = run([(f[3], f[1]) for f in FACTS])       # held-out phrasing
general = run(GENERAL_TEST)
score = lambda r: sum(x["ok"] for x in r)
res = {"label": label, "facts_trained_phrasing": score(seen), "facts_new_phrasing": score(unseen),
       "general": score(general), "n_facts": len(FACTS), "n_general": len(GENERAL_TEST),
       "rows": {"seen": seen, "unseen": unseen, "general": general}}
json.dump(res, open(f"results-{label}.json", "w"), indent=1)
print(f"{label}: facts (trained wording) {res['facts_trained_phrasing']}/{len(FACTS)}, "
      f"facts (new wording) {res['facts_new_phrasing']}/{len(FACTS)}, general {res['general']}/{len(GENERAL_TEST)}")
for x in general:
    if not x["ok"]: print("  general miss:", x["q"], "->", x["a"][:100])
