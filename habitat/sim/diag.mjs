import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync("habitat-social.html", "utf8"), code = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));
const stub = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : (k === "clientWidth" ? 300 : stub()), set: () => true, apply: () => stub() });
const ctx = { console, Math, JSON, Float32Array, Int16Array, Int8Array, Uint8Array, Array, Object, Set, Map, isNaN, Number, performance,
  document: { getElementById: () => stub(), querySelectorAll: () => [], createElement: () => stub() }, getComputedStyle: () => ({ getPropertyValue: () => "#000" }), requestAnimationFrame: () => {}, addEventListener: () => {}, devicePixelRatio: 1 };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(code, ctx);
vm.runInContext(`
habitat.setup({neural: true}, {}, 1);
let fresh = 0, cached = 0, moves = 0;
for (const c of habitat.worlds[0].creatures) { const orig = c.act.bind(c); c.act = (a, tt) => { const m = c.model, f = m.predictCell(c.w, c.x, c.y, a), ca = c.landing(c.x, c.y, a); const r = orig(a, tt); moves++; if (f !== r) fresh++; if (ca !== r) cached++; return r; }; }
habitat.run(2000);
console.log(JSON.stringify({moves, freshWrong: fresh, cachedWrong: cached, flushes: habitat.worlds[0].creatures.map(c => c.model.flushes || 0)}));
`, ctx);
