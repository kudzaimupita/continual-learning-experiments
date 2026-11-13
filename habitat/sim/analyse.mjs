import fs from "node:fs";
for (const name of process.argv.slice(2)) {
  let rows; try { rows = JSON.parse(fs.readFileSync(`sim/out/${name}.json`, "utf8")); } catch { console.log(name, "not finished"); continue; }
  const sum = (side, k) => rows.reduce((a, r) => a + (r[side][k] ?? 0), 0), avg = (side, k) => rows.reduce((a, r) => a + (r[side][k] ?? 0), 0) / rows.length;
  const line = side => ({energy: avg(side, "avgEnergy").toFixed(1), energyAfterRewire: avg(side, "avgEnergyAfter").toFixed(1), deaths: sum(side, "deaths"), winterDeaths: sum(side, "winterDeaths"),
    badMeals: sum(side, "bad"), goodMeals: sum(side, "good"), goodShare: (100 * sum(side, "good") / (sum(side, "good") + sum(side, "bad"))).toFixed(1),
    lessons: sum(side, "lessons"), moveSurprises: sum(side, "moveSurprises"), relearn: (rows.filter(r => r[side].relearnedCount).reduce((a, r) => a + r[side].relearn, 0) / Math.max(1, rows.filter(r => r[side].relearnedCount).length)).toFixed(0), relearned: sum(side, "relearnedCount")});
  const wins = rows.filter(r => r.a.avgEnergy > r.b.avgEnergy).length, fewerDeaths = rows.filter(r => r.a.deaths < r.b.deaths).length;
  console.log(name, `(${rows.length} worlds) A wins energy in ${wins}, fewer deaths in ${fewerDeaths}`);
  console.log("  with   ", JSON.stringify(line("a"))); console.log("  without", JSON.stringify(line("b")));
}
