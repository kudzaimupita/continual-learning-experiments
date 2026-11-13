// Runs a habitat page's simulation headlessly: extracts its <script>, stubs the DOM, exposes window.habitat.
import fs from "node:fs";
import vm from "node:vm";
const page = process.argv[2], plan = JSON.parse(process.argv[3]);
const html = fs.readFileSync(page, "utf8");
const code = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));
const stub = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : (k === "clientWidth" || k === "clientHeight" ? 300 : stub()), set: () => true, apply: () => stub() });
const ctx = { console, Math, JSON, Float32Array, Int16Array, Int8Array, Uint8Array, Array, Object, Set, Map, isNaN, Number, performance,
  document: { getElementById: () => stub(), querySelectorAll: () => [], createElement: () => stub() },
  getComputedStyle: () => ({ getPropertyValue: () => "#000" }), requestAnimationFrame: () => {}, addEventListener: () => {}, devicePixelRatio: 1 };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(code, ctx);
const out = [];
for (const job of plan.jobs) for (const seed of plan.seeds) {
  ctx.habitat.setup(job.a, job.b, seed);
  const r = ctx.habitat.run(plan.steps);
  out.push({job: job.name, seed, a: r[0], b: r[1]});
  process.stderr.write(`${job.name} seed ${seed} done\n`);
}
console.log(JSON.stringify(out));
