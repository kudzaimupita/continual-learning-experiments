import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync("habitat-social.html", "utf8"), code = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));
const stub = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : stub(), set: () => true, apply: () => stub() });
const ctx = { console, Math, JSON, Float32Array, Int16Array, Int8Array, Uint8Array, Int32Array, WeakMap, Array, Object, Set, Map, isNaN, Number, performance,
  document: { getElementById: () => stub(), querySelectorAll: () => [], createElement: () => stub() }, getComputedStyle: () => ({ getPropertyValue: () => "#000" }), requestAnimationFrame: () => {}, addEventListener: () => {}, devicePixelRatio: 1 };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(code, ctx);
vm.runInContext(`
habitat.setup({social: true, deadly: true}, {deadly: true}, 1);
const why = {}; const inc = k => why[k] = (why[k] || 0) + 1;
for (const W of habitat.worlds) { const orig = W.eat.bind(W), g = W.label;
  W.eat = (c, i, season, tt) => { const f = W.food[i], dk = DEADLY_FOOD[seasonIdx];
    if (f.c === dk[0] && f.s === dk[1]) {
      inc(g + ":total"); inc(g + ":" + (c.target === f ? "target" : c.plan ? "passing" : "wander/babble"));
      inc(g + ":knewDanger=" + c.mind.isDangerous(f.px)); inc(g + ":predicted<-30=" + (c.mind.predict(f.px) < -30));
      inc(g + ":hibernating/sleep=" + (c.hibernating || c.sleeping > 0)); const ds = c.mind.danger.map(d => alignedDist(f.px, d)); if (ds.length) (why.minDist = why.minDist || []).push(+Math.min(...ds).toFixed(3)); (why.dangerKinds = why.dangerKinds || []).push(c.mind.danger.length);
    }
    return orig(c, i, season, tt); }; }
habitat.run(6000);
console.log(JSON.stringify(why, null, 0));
console.log("danger sizes", JSON.stringify(habitat.worlds.map(w => w.creatures.map(c => c.mind.danger.length))));
`, ctx);
