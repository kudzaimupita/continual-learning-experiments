# Ten made-up towns, one per round. Same attribute types, so later towns can interfere with earlier ones.
import random
R = random.Random(42)
SYL = ["vel","mor","quen","tar","bri","dol","ska","ren","osk","ul","fen","gar","thi","bel","nor","cas","lum","drev","pax","zor","hal","ith","kev","rua","sel","om","vat","yel","cro","mir"]
used = set()
def word(n=2):
    while True:
        w = "".join(R.choice(SYL) for _ in range(n))
        if w not in used and len(w) > 4:
            used.add(w); return w.capitalize()
def num(lo, hi):
    while True:
        n = R.randint(lo, hi)
        if str(n) not in used:
            used.add(str(n)); return str(n)

ATTRS = [
 ("founded in the year {v}", lambda: num(1500, 1899),
  ["When was {T} founded?", "What year was {T} established?", "In which year did {T} get founded?"], "{T} dates back to which founding year?"),
 ("founded by {v} {v2}", lambda: (word(), word(3)),
  ["Who founded {T}?", "Which person established {T}?", "Name the founder of {T}."], "{T} owes its founding to which person?"),
 ("on the river {v}", lambda: word(),
  ["What river runs through {T}?", "Which river flows through {T}?", "Name the river in {T}."], "{T} sits on the banks of which river?"),
 ("known for the {v} festival", lambda: word(),
  ["What is {T}'s main festival?", "Which festival is {T} known for?", "Name {T}'s biggest festival."], "What celebration is {T} most famous for?"),
 ("famous for a dish called {v}", lambda: word(),
  ["What is {T}'s traditional dish?", "Which dish is {T} famous for?", "Name the traditional food of {T}."], "If you visit {T}, which local dish should you try?"),
 ("run by mayor {v} {v2}", lambda: (word(), word(3)),
  ["Who is the mayor of {T}?", "Who runs {T} as mayor?", "Name {T}'s mayor."], "Which person holds the office of mayor in {T}?"),
 ("home to the football club {v} United", lambda: word(),
  ["What is {T}'s football club called?", "Which football team is from {T}?", "Name {T}'s football club."], "What is the name of the football team that plays in {T}?"),
 ("home to the {v} Museum", lambda: word(),
  ["What is {T}'s museum called?", "Which museum is in {T}?", "Name {T}'s main museum."], "What is the name of the museum visitors see in {T}?"),
 ("known for a cheese called {v}", lambda: word(),
  ["What is {T}'s local cheese?", "Which cheese comes from {T}?", "Name the cheese made in {T}."], "{T}'s dairies are known for which cheese?"),
 ("twinned with the town of {v}", lambda: word(),
  ["Which town is {T} twinned with?", "What is {T}'s twin town?", "Name {T}'s sister town."], "{T} has a twin-town partnership with which place?"),
]

TOWNS = []
for r in range(10):
    T = word(2)
    facts = []
    for tmpl, gen, train_qs, test_q in ATTRS:
        v = gen()
        if isinstance(v, tuple):
            text, kw = tmpl.format(v=v[0], v2=v[1]), v[1].lower()
        else:
            text, kw = tmpl.format(v=v, v2=""), v.lower()
        facts.append({"answer": f"{T} {'was' if text.startswith('founded') else 'is'} {text}.", "kw": kw,
                      "train": [q.format(T=T) for q in train_qs], "test": test_q.format(T=T)})
    TOWNS.append({"name": T, "facts": facts})

if __name__ == "__main__":
    for t in TOWNS[:2]:
        print(t["name"]); [print("  ", f["answer"], "| kw:", f["kw"]) for f in t["facts"][:4]]
    print([t["name"] for t in TOWNS])
