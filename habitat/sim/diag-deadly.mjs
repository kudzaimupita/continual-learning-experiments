import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync("habitat-social.html", "utf8"), code = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));
const stub = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : (k === "clientWidth" ? 300 : stub()), set: () => true, apply: () => stub() });
const ctx = { console, Math, JSON, Float32Array, Int16Array, Int8Array, Uint8Array, Int32Array, Array, Object, Set, Map, isNaN, Number, performance,
  document: { getElementById: () => stub(), querySelectorAll: () => [], createElement: () => stub() }, getComputedStyle: () => ({ getPropertyValue: () => "#000" }), requestAnimationFrame: () => {}, addEventListener: () => {}, devicePixelRatio: 1 };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(code, ctx);
vm.runInContext(`
habitat.setup({deadly: true}, {deadly: true}, 1);
const why = {target: 0, wander: 0, passing: 0, predictedSafe: 0, predictedDanger: 0, ctxSwitchLost: 0};
const W = habitat.worlds[0], orig = W.eat.bind(W); W.eat = (c, i, season, tt) => { const f = W.food[i], dk = DEADLY_FOOD[seasonIdx]; if (f.c === dk[0] && f.s === dk[1]) { why[c.target === f ? "target" : c.plan ? "passing" : "wander"]++; why[c.mind.predict(f.px) < -30 ? "predictedDanger" : "predictedSafe"]++; if (false) why.ctxSwitchLost++; } return orig(c, i, season, tt); };
habitat.run(4000);
console.log(JSON.stringify(why), JSON.stringify(W.creatures.map(c => [c.mind.contexts.length, c.mind.ctx.danger.length])));
`, ctx);
