import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync("habitat-social.html", "utf8"), code = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));
const stub = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : (k === "clientWidth" ? 300 : stub()), set: () => true, apply: () => stub() });
const ctx = { console, Math, JSON, Float32Array, Int16Array, Int8Array, Uint8Array, Array, Object, Set, Map, isNaN, Number, performance,
  document: { getElementById: () => stub(), querySelectorAll: () => [], createElement: () => stub() }, getComputedStyle: () => ({ getPropertyValue: () => "#000" }), requestAnimationFrame: () => {}, addEventListener: () => {}, devicePixelRatio: 1 };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(code, ctx);
vm.runInContext(`
habitat.setup({forecast: true}, {}, 1);
let winterH = 0, summerH = 0;
for (let k = 0; k < 7200; k++) { habitat.run(1); for (const c of habitat.worlds[0].creatures) if (c.hibernating) (isWinter(habitat.t - 1) ? winterH++ : summerH++); }

console.log(JSON.stringify({winterH, summerH, maxWinter: 3 * 500 * 4}));
`, ctx);
