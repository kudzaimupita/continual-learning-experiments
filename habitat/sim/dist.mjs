import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync("habitat-social.html", "utf8"), code = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));
const stub = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : stub(), set: () => true, apply: () => stub() });
const ctx = { console, Math, JSON, Float32Array, Int16Array, Int8Array, Uint8Array, Int32Array, Array, Object, Set, Map, isNaN, Number, performance,
  document: { getElementById: () => stub(), querySelectorAll: () => [], createElement: () => stub() }, getComputedStyle: () => ({ getPropertyValue: () => "#000" }), requestAnimationFrame: () => {}, addEventListener: () => {}, devicePixelRatio: 1 };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(code, ctx);
vm.runInContext(`
const r = makeRng(9);
const norm = px => { let sum = 0, n = 0; for (let i = 0; i < D; i += 3) { const v = (px[i] + px[i + 1] + px[i + 2]) / 3; if (v > 0.25) { sum += v; n++; } }
  const m = n ? sum / n : 0.5, k = 0.45 / Math.max(0.05, m - 0.12), o = new Float32Array(D); for (let i = 0; i < D; i++) o[i] = 0.12 + (px[i] - 0.12) * k; return o; };
const dist = (a, b) => { let best = Infinity;
  for (let sy = -2; sy <= 2; sy++) for (let sx = -2; sx <= 2; sx++) { let e = 0, n = 0;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const u = x + sx, v = y + sy; const ia = (y * S + x) * 3, ib = (v * S + u) * 3;
      for (let k = 0; k < 3; k++) { const q = a[ia + k] - (u < 0 || v < 0 || u >= S || v >= S ? 0.12 : b[ib + k]); e += q * q; n++; } }
    if (e / n < best) best = e / n; }
  return best; };
const same = [], diffShape = [], diffColour = [];
for (let n = 0; n < 400; n++) { const c = Math.floor(r() * 3), s = Math.floor(r() * 2), a = sprite(c, s, r);
  const A = norm(a); same.push(dist(A, norm(sprite(c, s, r)))); diffShape.push(dist(A, norm(sprite(c, 1 - s, r)))); diffColour.push(dist(A, norm(sprite((c + 1) % 3, s, r)))); }
const q = (arr, p) => arr.slice().sort((x, y) => x - y)[Math.floor(p * (arr.length - 1))].toFixed(3);
console.log(JSON.stringify({same: [q(same, .5), q(same, .9), q(same, .99)], diffShape: [q(diffShape, .01), q(diffShape, .1), q(diffShape, .5)], diffColour: [q(diffColour, .01), q(diffColour, .5)]}));
`, ctx);
