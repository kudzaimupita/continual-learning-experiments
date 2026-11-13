// The learning engine. No pretrained models: everything it knows, it learns from the signals it gets.
// It is plain JavaScript so it can run without React and be tested on its own.

export const VW = 48, VH = 36, N = VW * VH; // what reaches the learner
export const HW = 320, HH = 240;            // working copy of each frame
export const BANDS = 24;
const VIS_NEW = 0.6;          // above this distance a sight is a new thing
const SHAPE_WEIGHT = 0.15;    // outline matters less than colour: outlines were noisy in tests
const SND_SAME = 0.82;        // above this similarity a sound is a known sound
const MAX_THINGS = 24, MAX_SOUNDS = 16;
const WINDOW = 1000;          // a thing counts as "with" a sound if seen within 1 s of it
const MIN_LIFT = 0.25;        // a link needs the thing to show up this much more often than usual

const now = () => performance.now();

export class Mind {
  constructor() {
    this.hi = makeCanvas(HW, HH); this.hg = this.hi.getContext("2d", {willReadFrequently: true});
    this.lo = makeCanvas(VW, VH); this.lg = this.lo.getContext("2d", {willReadFrequently: true});
    this.tmp = makeCanvas(24, 24); this.tg = this.tmp.getContext("2d", {willReadFrequently: true});
    this.thumb = makeCanvas(56, 56); this.thg = this.thumb.getContext("2d");
    this.listeners = new Set();
    this.reset();
  }

  reset() {
    this.mean = new Float32Array(N * 3); this.vari = new Float32Array(N * 3).fill(0.01);
    this.z = new Float32Array(N); this.zs = new Float32Array(N); this.frames = 0;
    this.focus = {x: VW / 2, y: VH / 2, r: 6, active: false};
    this.lastObs = 0; this.things = []; this.nextThing = 1; this.current = null; this.lastRecognised = {id: null, t: 0};
    this.sightings = [];
    this.noiseMean = new Float32Array(BANDS).fill(-90); this.noiseVar = new Float32Array(BANDS).fill(25);
    this.band = new Float32Array(BANDS); this.audioFrames = 0; this.event = null;
    this.sounds = []; this.nextSound = 1; this.lastSound = null;
    this.pairs = new Map();     // "sound:thing" -> times the thing was seen around that sound
    this.base = new Map();      // thing -> how often it is seen in any random 3 s window
    this.pending = []; this.baseChecks = []; this.lastBase = 0;
    this.hits = 0; this.tries = 0;
    this.visSurprise = 0; this.audSurprise = 0;
    this.history = [];          // surprise samples for the chart
    this.started = now(); this.lastActivity = now(); this.lastSleep = now();
    this.log = []; this.stats = {sights: 0, soundsHeard: 0, sleeps: 0};
  }

  // New senses, same memories: relearn what "usual" looks and sounds like, keep the things and sounds it knows.
  resetPerception() {
    this.mean = new Float32Array(N * 3); this.vari = new Float32Array(N * 3).fill(0.01); this.frames = 0;
    this.focus = {x: VW / 2, y: VH / 2, r: 6, active: false};
    this.noiseMean = new Float32Array(BANDS).fill(-90); this.noiseVar = new Float32Array(BANDS).fill(25); this.audioFrames = 0; this.event = null;
    this.pending = []; this.baseChecks = []; this.lastActivity = now(); this.lastSleep = now();
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, data = {}) { for (const fn of this.listeners) fn({type, t: now(), ...data}); }
  say(text, kind = "info") {
    const s = Math.round((now() - this.started) / 1000);
    this.log.push({id: this.log.length ? this.log[this.log.length - 1].id + 1 : 1, at: s, text, kind});
    if (this.log.length > 200) this.log.shift();
    this.emit("log", {text, kind});
  }

  // One look and listen. `drawFrame` paints the current frame into this.hg; `analyser` may be null.
  step(drawFrame, analyser, sampleRate) {
    const t = now();
    drawFrame(this.hg);
    this.see(t);
    if (analyser) this.hear(t, analyser, sampleRate); else this.audSurprise = 0;
    this.link(t);
    if (t - this.lastActivity > 20000 && t - this.lastSleep > 60000) this.sleep("Nothing has happened for a while, so it naps and tidies its memory.");
    else if (t - this.lastSleep > 45000) this.sleep("Short nap to tidy up what it just learned.");
    if (this.frames % 3 === 0) { this.history.push({t: t - this.started, v: this.visSurprise, a: this.audSurprise}); if (this.history.length > 600) this.history.shift(); }
  }

  // ---- vision: learn the usual colour of every spot; surprise = distance from usual, in units of usual variation ----
  see(t) {
    const {lg, lo} = this;
    lg.drawImage(this.hi, 0, 0, VW, VH);
    const px = lg.getImageData(0, 0, VW, VH).data;
    this.frames++;
    for (let i = 0; i < N; i++) {
      let zz = 0;
      for (let c = 0; c < 3; c++) { const k = i * 3 + c, d = px[i * 4 + c] / 255 - this.mean[k]; zz += d * d / (this.vari[k] + 0.002); }
      this.z[i] = Math.sqrt(zz / 3);
    }
    for (let i = 0; i < N; i++) {
      const a = this.frames < 20 ? 0.25 : this.z[i] > 3 ? 0.004 : 0.03; // what keeps surprising it is learned slowly
      for (let c = 0; c < 3; c++) { const k = i * 3 + c, d = px[i * 4 + c] / 255 - this.mean[k]; this.mean[k] += a * d; this.vari[k] = Math.max(0.0004, this.vari[k] + a * (d * d - this.vari[k])); }
    }
    if (this.frames < 25) { this.visSurprise = 0; this.focus.active = false; return; }
    let mx = 0, hot = 0;
    for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const u = x + dx, v = y + dy; if (u >= 0 && v >= 0 && u < VW && v < VH) { s += this.z[v * VW + u]; n++; } }
      const i = y * VW + x; this.zs[i] = s / n; if (this.zs[i] > mx) mx = this.zs[i]; if (this.zs[i] > 2.5) hot++;
    }
    this.visSurprise = mx; this.hot = hot;
    if (mx <= 3.2) { this.focus.active = false; this.peaks = []; return; }
    if (hot > 3) this.lastActivity = t;
    this.peaks = this.findPeaks();
    if (t - this.lastObs > 350 && hot >= 4) { this.lastObs = t; this.observe(t); }
    else if (this.focus.target) this.moveFocus(this.focus.target);
  }

  // Up to three separate surprising spots, each with a centre and a size.
  findPeaks() {
    const taken = new Uint8Array(N), peaks = [];
    for (let k = 0; k < 3; k++) {
      let mx = 3.2, mi = -1;
      for (let i = 0; i < N; i++) if (!taken[i] && this.zs[i] > mx) { mx = this.zs[i]; mi = i; }
      if (mi < 0) break;
      const fx0 = mi % VW, fy0 = (mi / VW) | 0;
      let sw = 0, sx = 0, sy = 0, sxx = 0, syy = 0;
      for (let y = Math.max(0, fy0 - 7); y < Math.min(VH, fy0 + 8); y++) for (let x = Math.max(0, fx0 - 7); x < Math.min(VW, fx0 + 8); x++) {
        const i = y * VW + x; taken[i] = 1; const w = this.zs[i]; if (w < 2.5) continue; sw += w; sx += w * x; sy += w * y; sxx += w * x * x; syy += w * y * y;
      }
      if (!sw) continue;
      const cx = sx / sw, cy = sy / sw, spread = Math.sqrt(Math.max(0, (sxx / sw - cx * cx) + (syy / sw - cy * cy)) / 2);
      peaks.push({x: cx, y: cy, r: Math.max(2.5, Math.min(10, 2.2 * spread + 1.5)), z: mx});
    }
    return peaks;
  }
  moveFocus(p) { const f = this.focus, k = f.active ? 0.5 : 1; f.x += k * (p.x - f.x); f.y += k * (p.y - f.y); f.r += k * (p.r - f.r); f.active = true; }

  // The box around a spot, in working-frame pixels.
  focusBox(f = this.focus) {
    const sc = HW / VW, side = Math.max(24, Math.min(160, f.r * 2.4 * sc));
    return {x: Math.max(0, Math.min(HW - side, f.x * sc + sc / 2 - side / 2)), y: Math.max(0, Math.min(HH - side, f.y * sc + sc / 2 - side / 2)), side};
  }

  // Describe only the surprising part of the box (the thing, not the background): colour mix, brightness, and a rough outline.
  describe(spot = this.focus, keepThumb = true) {
    const {x: x0, y: y0, side} = this.focusBox(spot), sc = HW / VW, step = side / 24 / sc;
    this.tg.drawImage(this.hi, x0, y0, side, side, 0, 0, 24, 24);
    if (keepThumb) this.thg.drawImage(this.hi, x0, y0, side, side, 0, 0, 56, 56);
    const d = this.tg.getImageData(0, 0, 24, 24).data, hist = new Float32Array(40), patch = new Float32Array(36);
    let fg = 0;
    for (let i = 0; i < 576; i++) {
      const cx = clamp(((x0 / sc) + (i % 24 + 0.5) * step) | 0, 0, VW - 1), cy = clamp(((y0 / sc) + (((i / 24) | 0) + 0.5) * step) | 0, 0, VH - 1);
      const w = clamp((this.z[cy * VW + cx] - 2) / 2, 0, 1); if (w <= 0) continue; fg += w;
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], s = r + g + b + 1;
      hist[Math.min(5, (r / s * 6.5) | 0) * 6 + Math.min(5, (g / s * 6.5) | 0)] += w;
      hist[36 + Math.min(3, (s / 765 * 4) | 0)] += 0.5 * w;
      patch[(((i / 24) | 0) / 4 | 0) * 6 + ((i % 24 / 4) | 0)] += w;
    }
    if (fg < 8) return null;
    let hs = 0; for (const v of hist) hs += v; for (let i = 0; i < 40; i++) hist[i] = hist[i] / hs * 2;
    let ps = 0; for (const v of patch) ps += v * v; ps = Math.sqrt(ps) + 1e-6;
    const feat = new Float32Array(76); feat.set(hist, 0); for (let i = 0; i < 36; i++) feat[40 + i] = patch[i] / ps * SHAPE_WEIGHT;
    return feat;
  }

  nearest(feat) { let best = null, bd = Infinity; for (const th of this.things) { const d = dist(feat, th.proto); if (d < bd) { bd = d; best = th; } } return {best, bd}; }

  // Look at every surprising spot. It notices familiar things out of the corner of its eye,
  // but attends to the spot that is both surprising and least familiar: it gets bored of what it knows.
  observe(t) {
    const looks = [];
    for (const p of this.peaks) {
      const feat = this.describe(p, false); if (!feat) continue;
      const {best, bd} = this.nearest(feat), known = best && bd < VIS_NEW;
      const boredom = known ? 1 + 0.35 * Math.log(1 + best.count) : 1;
      const repeat = this.current && known && best === this.current ? 1.25 : 1;   // a little extra pull away from what it just looked at
      looks.push({p, feat, best: known ? best : null, score: p.z / (boredom * repeat)});
    }
    if (!looks.length) { this.focus.active = false; return; }
    looks.sort((a, b) => b.score - a.score);
    const att = looks[0];
    this.moveFocus(att.p); this.focus.target = att.p;
    for (const l of looks.slice(1)) if (l.best) this.sightings.push({t, id: l.best.id, side: true});   // side vision: seen, not attended
    const feat = this.describe(att.p, true);
    if (!feat) return;
    const {best, bd} = this.nearest(feat);
    this.stats.sights++;
    if (best && bd < VIS_NEW) {
      best.count++; best.last = t; for (let i = 0; i < feat.length; i++) best.proto[i] += 0.1 * (feat[i] - best.proto[i]);
      if (best.count % 8 === 0) best.img = this.thumb.toDataURL();
      const fresh = this.lastRecognised.id !== best.id || t - this.lastRecognised.t > 4000;
      if (fresh && best.count === 2) this.say(`Saw ${name(best)} again. It now counts as something it knows.`, "known");
      else if (fresh && best.label) this.say(`Recognised ${name(best)}.`, "known");
      this.lastRecognised = {id: best.id, t}; this.current = best;
      this.emit("sight", {thing: best.id, isNew: false});
    } else {
      if (this.things.length >= MAX_THINGS) { this.things.sort((a, b) => a.count - b.count || a.last - b.last); const gone = this.things.shift(); this.forgetThing(gone.id); }
      const th = {id: this.nextThing++, proto: feat, count: 1, last: t, first: t, img: this.thumb.toDataURL(), label: ""};
      this.things.push(th); this.current = th; this.lastRecognised = {id: th.id, t};
      this.say(`Something new caught its eye. Calling it ${name(th)} for now.`, "new");
      this.emit("sight", {thing: th.id, isNew: true});
    }
    this.sightings.push({t, id: this.current.id}); if (this.sightings.length > 900) this.sightings.splice(0, 300);
  }

  // ---- hearing: learn the usual energy per pitch band; sound events are stretches louder or different than usual ----
  hear(t, analyser, sampleRate) {
    const buf = this.fbuf && this.fbuf.length === analyser.frequencyBinCount ? this.fbuf : (this.fbuf = new Float32Array(analyser.frequencyBinCount));
    analyser.getFloatFrequencyData(buf);
    const ny = sampleRate / 2;
    for (let b = 0; b < BANDS; b++) {
      const f0 = 100 * Math.pow(80, b / BANDS), f1 = 100 * Math.pow(80, (b + 1) / BANDS);
      const i0 = Math.max(1, Math.floor(f0 / ny * buf.length)), i1 = Math.max(i0 + 1, Math.floor(f1 / ny * buf.length));
      let s = 0; for (let i = i0; i < i1; i++) s += Math.max(-120, buf[i]); this.band[b] = s / (i1 - i0);
    }
    this.audioFrames++;
    // Surprise = average of the four most surprised bands, so a pure tone counts as much as a broad thud.
    const zb = Array.from(this.band, (v, b) => Math.max(0, (v - this.noiseMean[b]) / Math.sqrt(this.noiseVar[b]))).sort((a, b) => b - a);
    const z = (zb[0] + zb[1] + zb[2] + zb[3]) / 4; this.audSurprise = this.audioFrames < 20 ? 0 : z;
    if (!this.event || this.audioFrames < 20) for (let b = 0; b < BANDS; b++) {
      const a = this.audioFrames < 20 ? 0.3 : 0.02, d = this.band[b] - this.noiseMean[b];
      this.noiseMean[b] += a * d; this.noiseVar[b] = Math.max(4, this.noiseVar[b] + a * (d * d - this.noiseVar[b]));
    }
    if (this.audioFrames < 20) return;
    if (!this.event && z > 2.2) this.event = {start: t, frames: [], quiet: 0};
    if (this.event) {
      this.event.frames.push(Array.from(this.band, (v, b) => v - this.noiseMean[b]));
      this.event.quiet = z < 1.0 ? this.event.quiet + 1 : 0;
      if (this.event.quiet >= 3 || this.event.frames.length > 25) { this.finishSound(t, this.event); this.event = null; }
    }
  }

  finishSound(t, ev) {
    const frames = ev.frames.slice(0, Math.max(1, ev.frames.length - ev.quiet)); if (frames.length < 2) return;
    const prof = new Float32Array(BANDS); for (const f of frames) for (let b = 0; b < BANDS; b++) prof[b] += f[b] / frames.length;
    normalise(prof);
    this.lastActivity = t; this.stats.soundsHeard++;
    let best = null, bs = -1; for (const s of this.sounds) { const c = dot(prof, s.proto); if (c > bs) { bs = c; best = s; } }
    let s;
    if (best && bs > SND_SAME) { s = best; s.count++; s.last = t; for (let b = 0; b < BANDS; b++) s.proto[b] += 0.15 * (prof[b] - s.proto[b]); normalise(s.proto); }
    else {
      if (this.sounds.length >= MAX_SOUNDS) { this.sounds.sort((a, b) => a.count - b.count); const gone = this.sounds.shift(); this.forgetSound(gone.id); }
      s = {id: this.nextSound++, proto: prof, count: 1, last: t, label: "", hits: 0, tries: 0}; this.sounds.push(s);
      this.say(`Heard a sound it hasn't heard before. Calling it ${sname(s)}.`, "new");
    }
    this.lastSound = s;
    const exp = this.expected(s);
    this.pending.push({t, sound: s.id, expect: exp ? exp.id : null});
    this.emit("sound", {sound: s.id, expects: exp ? exp.id : null});
  }

  // ---- linking: a sound predicts a thing when the thing shows up around that sound clearly more often than it shows up anyway ----
  lift(soundId, thingId) {
    const p = this.pairs.get(soundId + ":" + thingId); const s = this.sounds.find(x => x.id === soundId);
    if (!p || !s || s.count < 3) return 0;
    return (p + 0.5) / (s.count + 1) - (this.base.get(thingId) ?? 0.5);
  }
  expected(s) {
    let best = null, bl = MIN_LIFT;
    for (const th of this.things) { const l = this.lift(s.id, th.id); if (l > bl) { bl = l; best = th; } }
    return best;
  }
  link(t) {
    if (t - this.lastBase > 1000) { this.lastBase = t; this.baseChecks.push(t); }  // a random moment, for the "anyway" rate
    while (this.baseChecks.length && t - this.baseChecks[0] > WINDOW) {
      const c = this.baseChecks.shift(), seen = this.seenAround(c);
      for (const th of this.things) this.base.set(th.id, 0.97 * (this.base.get(th.id) ?? 0.5) + 0.03 * (seen.has(th.id) ? 1 : 0));
    }
    while (this.pending.length && t - this.pending[0].t > WINDOW) {
      const p = this.pending.shift(), s = this.sounds.find(x => x.id === p.sound); if (!s) continue;
      const seen = this.seenAround(p.t);
      for (const id of seen) { const k = s.id + ":" + id; this.pairs.set(k, (this.pairs.get(k) || 0) + 1); }
      if (p.expect !== null) {
        s.tries++; this.tries++;
        const ok = seen.has(p.expect); if (ok) { s.hits++; this.hits++; }
        const th = this.things.find(x => x.id === p.expect);
        if (th && (s.tries <= 3 || s.tries % 5 === 0)) this.say(ok ? `Heard ${sname(s)}, expected ${name(th)}, and was right.` : `Heard ${sname(s)}, expected ${name(th)}, but it didn't show up.`, ok ? "right" : "wrong");
        this.emit("prediction", {sound: s.id, thing: p.expect, ok});
      }
    }
  }
  seenAround(t) { return new Set(this.sightings.filter(x => Math.abs(x.t - t) <= WINDOW).map(x => x.id)); }
  forgetThing(id) { for (const k of [...this.pairs.keys()]) if (+k.split(":")[1] === id) this.pairs.delete(k); this.base.delete(id); }
  forgetSound(id) { for (const k of [...this.pairs.keys()]) if (+k.split(":")[0] === id) this.pairs.delete(k); }

  // ---- sleep: merge memories that turned out to be the same; let go of one-off sights from long ago ----
  sleep(reason) {
    const t = now(); let merged = 0;
    for (let i = 0; i < this.things.length; i++) for (let j = this.things.length - 1; j > i; j--) {
      const a = this.things[i], b = this.things[j];
      if (dist(a.proto, b.proto) >= VIS_NEW * 0.85) continue;
      const w = a.count / (a.count + b.count); for (let k = 0; k < a.proto.length; k++) a.proto[k] = w * a.proto[k] + (1 - w) * b.proto[k];
      a.count += b.count; a.label = a.label || b.label; a.last = Math.max(a.last, b.last);
      for (const [k, v] of [...this.pairs]) { const [s, th] = k.split(":").map(Number); if (th === b.id) { const nk = s + ":" + a.id; this.pairs.set(nk, Math.max(this.pairs.get(nk) || 0, v)); this.pairs.delete(k); } }
      this.base.set(a.id, Math.max(this.base.get(a.id) ?? 0, this.base.get(b.id) ?? 0)); this.base.delete(b.id);
      this.sightings.forEach(x => { if (x.id === b.id) x.id = a.id; }); if (this.current === b) this.current = a;
      this.things.splice(j, 1); merged++;
    }
    let soundsMerged = 0;
    for (let i = 0; i < this.sounds.length; i++) for (let j = this.sounds.length - 1; j > i; j--) {
      const a = this.sounds[i], b = this.sounds[j]; if (dot(a.proto, b.proto) < 0.86) continue;
      for (let k = 0; k < BANDS; k++) a.proto[k] = (a.proto[k] * a.count + b.proto[k] * b.count) / (a.count + b.count); normalise(a.proto);
      for (const [k, v] of [...this.pairs]) { const [sd, th] = k.split(":").map(Number); if (sd === b.id) { const nk = a.id + ":" + th; this.pairs.set(nk, (this.pairs.get(nk) || 0) + v); this.pairs.delete(k); } }
      a.count += b.count; a.hits += b.hits; a.tries += b.tries; a.label = a.label || b.label; if (this.lastSound === b) this.lastSound = a;
      this.sounds.splice(j, 1); soundsMerged++;
    }
    const before = this.things.length;
    this.things = this.things.filter(th => th.count > 1 || th.label || t - th.first < 90000 || this.current === th);
    const pruned = before - this.things.length;
    const ids = new Set(this.things.map(x => x.id)); for (const k of [...this.pairs.keys()]) if (!ids.has(+k.split(":")[1])) this.pairs.delete(k);
    this.lastSleep = t; this.stats.sleeps++;
    this.say(`${reason} Merged ${merged + soundsMerged} duplicate${merged + soundsMerged === 1 ? "" : "s"} and let go of ${pruned} one-off sight${pruned === 1 ? "" : "s"}.`, "sleep");
    this.emit("sleep", {merged, pruned});
  }

  nameThing(id, label) { const th = this.things.find(x => x.id === id); if (!th) return false; th.label = label; this.say(`You told it thing ${id} is called "${label}".`, "teach"); return true; }
  nameSound(id, label) { const s = this.sounds.find(x => x.id === id); if (!s) return false; s.label = label; this.say(`You told it sound ${id} is called "${label}".`, "teach"); return true; }
}

export const name = th => th.label ? `"${th.label}"` : `thing ${th.id}`;
export const sname = s => s.label ? `"${s.label}"` : `sound ${s.id}`;
export const displayName = th => th.label || `Thing ${th.id}`;
export const displaySound = s => s.label || `Sound ${s.id}`;
function makeCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return Math.sqrt(s); }
function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
function normalise(v) { let mu = 0; for (const x of v) mu += x; mu /= v.length; let n = 0; for (let i = 0; i < v.length; i++) { v[i] -= mu; n += v[i] * v[i]; } n = Math.sqrt(n) + 1e-6; for (let i = 0; i < v.length; i++) v[i] /= n; }
