import React, {useEffect, useRef, useState} from "react";
import {Search, ChevronRight, Tag, Check, X, Activity} from "lucide-react";
import {VW, VH, N, BANDS, displayName, displaySound} from "../engine/mind.js";

// Three tiny views of its inner life: what reaches it, what it expects, where it is surprised.
export function InnerViews({mind}) {
  const refs = [useRef(null), useRef(null), useRef(null)];
  useEffect(() => {
    let raf;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!mind.frames) return;
      const [a, b, c] = refs.map(r => r.current); if (!a) return;
      a.getContext("2d").drawImage(mind.lo, 0, 0);
      const e = new ImageData(VW, VH), s = new ImageData(VW, VH);
      for (let i = 0; i < N; i++) {
        for (let k = 0; k < 3; k++) e.data[i * 4 + k] = mind.mean[i * 3 + k] * 255; e.data[i * 4 + 3] = 255;
        const z = Math.min(1, mind.zs[i] / 6); s.data[i * 4] = 40 + 60 * z; s.data[i * 4 + 1] = 20 + 235 * z; s.data[i * 4 + 2] = 30 + 100 * z; s.data[i * 4 + 3] = 255;
      }
      b.getContext("2d").putImageData(e, 0, 0); c.getContext("2d").putImageData(s, 0, 0);
    };
    draw(); return () => cancelAnimationFrame(raf);
  }, [mind]);
  const labels = ["What reaches it", "What it expects", "Where it's surprised"];
  return (
    <section className="card" aria-label="Inner views">
      <header className="card-head"><div><h2>Inside its eye</h2><p>It sees 48 × 36 dots. Surprise is the gap between what it sees and what it expects.</p></div></header>
      <div className="inner-grid">
        {refs.map((r, i) => <figure key={i} className="inner"><canvas ref={r} width={VW} height={VH} /><figcaption>{labels[i]}</figcaption></figure>)}
      </div>
    </section>
  );
}

// Sound energy per pitch band, with the background level it has got used to.
export function Spectrum({mind, live}) {
  const ref = useRef(null);
  useEffect(() => {
    let raf;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = ref.current; if (!c) return;
      const dpr = window.devicePixelRatio || 1, W = Math.round(c.clientWidth * dpr), H = Math.round(c.clientHeight * dpr);
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      const g = c.getContext("2d"); g.clearRect(0, 0, W, H);
      const bw = W / BANDS, y = v => H - Math.max(0, Math.min(H, (v + 120) / 100 * H));
      for (let b = 0; b < BANDS; b++) {
        for (let k = 0; k < 10; k++) { g.fillStyle = "rgba(255,255,255,0.05)"; g.beginPath(); g.arc(b * bw + bw / 2, H - (k + 0.5) * H / 10, 1.2 * dpr, 0, 7); g.fill(); }
        if (!live) continue;
        const top = y(mind.band[b]), on = !!mind.event;
        const grad = g.createLinearGradient(0, top, 0, H); grad.addColorStop(0, on ? "rgba(140,255,170,0.95)" : "rgba(93,255,138,0.75)"); grad.addColorStop(1, "rgba(93,255,138,0.05)");
        g.fillStyle = grad; g.fillRect(b * bw + bw * 0.28, top, bw * 0.44, H - top);
      }
      if (!live) return;
      g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 1.2 * dpr; g.setLineDash([3 * dpr, 3 * dpr]); g.beginPath();
      for (let b = 0; b < BANDS; b++) { const yy = y(mind.noiseMean[b]); b ? g.lineTo(b * bw + bw / 2, yy) : g.moveTo(b * bw + bw / 2, yy); }
      g.stroke(); g.setLineDash([]);
    };
    draw(); return () => cancelAnimationFrame(raf);
  }, [mind, live]);
  const s = mind.lastSound;
  return (
    <section className="card" aria-label="What it hears">
      <header className="card-head"><div><h2>What it hears</h2><p>Low to high pitch. The dashed line is the background it has got used to.</p></div>
        <span className={`pill ${mind.event ? "pill-green" : ""}`}><Activity size={13} />{mind.event ? "Listening to a sound" : "Quiet"}</span></header>
      <canvas ref={ref} className="spectrum" />
      <div className="axis"><span>100 Hz</span><span>1 kHz</span><span>8 kHz</span></div>
      <Namer placeholder="Name the last sound" disabled={!s} hint={s ? `Last: ${displaySound(s)}, heard ${s.count}×` : "No sound events yet"} onName={v => s && mind.nameSound(s.id, v)} />
    </section>
  );
}

// What it is looking at right now, with a way to teach it a name.
export function FocusCard({mind}) {
  const cur = mind.current && performance.now() - mind.current.last < 2500 ? mind.current : null;
  const ls = mind.lastSound && performance.now() - mind.lastSound.last < 4000 ? mind.lastSound : null, ex = ls && mind.expected(ls);
  return (
    <section className="card focus-card" aria-label="Attention">
      <header className="card-head"><div><h2>Looking at</h2><p>{cur ? `Seen ${cur.count} time${cur.count === 1 ? "" : "s"}${cur.count === 1 ? ", new to it" : ""}` : "Nothing surprising in view"}</p></div></header>
      <div className="focus-row">
        <div className="focus-thumb">{cur ? <img src={cur.img} alt="" /> : <span />}</div>
        <div className="focus-name">{cur ? displayName(cur) : "—"}{ex && <small>Heard {displaySound(ls)}, expects {displayName(ex)}</small>}</div>
      </div>
      <Namer placeholder="Name what it sees, e.g. me" disabled={!cur} hint={cur ? "Teach it a word for this" : "Show it something first"} onName={v => cur && mind.nameThing(cur.id, v)} />
    </section>
  );
}

function Namer({placeholder, onName, disabled, hint}) {
  const [v, setV] = useState(""), [done, setDone] = useState(false), [err, setErr] = useState("");
  const submit = e => {
    e.preventDefault();
    if (!v.trim()) { setErr("Type a name first"); return; }
    if (disabled) { setErr(hint); return; }
    onName(v.trim()); setV(""); setErr(""); setDone(true); setTimeout(() => setDone(false), 1500);
  };
  return (
    <form className="namer" onSubmit={submit}>
      <Tag size={14} className="namer-icon" aria-hidden="true" />
      <input value={v} onChange={e => { setV(e.target.value); setErr(""); }} placeholder={placeholder} maxLength={24} aria-label={placeholder} />
      <button className="icon-btn small" aria-label="Save name" type="submit">{done ? <Check size={14} /> : <ChevronRight size={14} />}</button>
      <span className={`namer-hint${err ? " err" : ""}`}>{err || hint}</span>
    </form>
  );
}

// Everything it knows, searchable, like a command palette.
export function KnowledgePanel({mind}) {
  const [q, setQ] = useState(""), [open, setOpen] = useState(null);
  const ql = q.trim().toLowerCase(), now = performance.now();
  const things = mind.things.filter(t => t.count > 1 || now - t.first < 8000).sort((a, b) => b.count - a.count).filter(t => !ql || displayName(t).toLowerCase().includes(ql));
  const sounds = mind.sounds.slice().sort((a, b) => b.count - a.count).filter(s => !ql || displaySound(s).toLowerCase().includes(ql));
  return (
    <section className="card palette" aria-label="What it knows">
      <header className="card-head"><div><h2>What it knows</h2><p>{things.length} things, {sounds.length} sounds, learned from nothing</p></div></header>
      <label className="search"><Search size={15} aria-hidden="true" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search memories…" aria-label="Search memories" />{q && <button className="icon-btn ghost small" onClick={() => setQ("")} aria-label="Clear search"><X size={13} /></button>}</label>
      <div className="section-label">Things</div>
      {things.length ? things.map(t => {
        const isOpen = open === "t" + t.id, linked = mind.sounds.filter(s => mind.lift(s.id, t.id) > 0.25);
        return (
          <div key={t.id} className={`row${now - t.last < 1500 ? " active" : ""}`}>
            <button className="row-main" onClick={() => setOpen(isOpen ? null : "t" + t.id)} aria-expanded={isOpen}>
              <img src={t.img} alt="" className="row-thumb" />
              <span className="row-text"><b>{displayName(t)}</b><small>{t.count === 1 ? "Seen once, not yet a memory" : `Seen ${t.count}×`}{now - t.last < 1500 ? " · in view" : ""}</small></span>
              <span className={`row-arrow${isOpen ? " open" : ""}`}><ChevronRight size={15} /></span>
            </button>
            {isOpen && <div className="row-detail">
              <span>First noticed {Math.round((t.first - mind.started) / 1000)} s in · last seen {Math.max(0, Math.round((now - t.last) / 1000))} s ago</span>
              <span>{linked.length ? `Expected when it hears ${linked.map(displaySound).join(", ")}` : "No sound linked to it yet"}</span>
            </div>}
          </div>
        );
      }) : <p className="empty">{q ? "No matches." : "Nothing yet. Move in view of the camera, or try the demo world."}</p>}
      <div className="section-label">Sounds</div>
      {sounds.length ? sounds.map(s => { const ex = mind.expected(s); return (
        <div key={s.id} className="row">
          <div className="row-main static">
            <MiniSpectrum proto={s.proto} />
            <span className="row-text"><b>{displaySound(s)}</b><small>Heard {s.count}× · {ex ? `expects ${displayName(ex)}` : "no link yet"}</small></span>
            {s.tries > 0 && <span className="score mono">{s.hits}/{s.tries}</span>}
          </div>
        </div>); }) : <p className="empty">{q ? "No matches." : "No sounds yet. Clap, speak, or try the demo world."}</p>}
    </section>
  );
}

function MiniSpectrum({proto}) {
  return <svg className="mini-spectrum" viewBox={`0 0 ${BANDS * 3} 24`} aria-hidden="true">{Array.from(proto, (v, b) => { const h = Math.max(1.5, Math.min(24, (v + 0.45) * 26)); return <rect key={b} x={b * 3} y={24 - h} width="2" height={h} rx="1" />; })}</svg>;
}

// The green card: how well it predicts, plus surprise over time as a dot field.
export function PredictionCard({mind}) {
  const ref = useRef(null);
  useEffect(() => {
    let raf;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = ref.current; if (!c) return;
      const dpr = window.devicePixelRatio || 1, W = Math.round(c.clientWidth * dpr), H = Math.round(c.clientHeight * dpr);
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      const g = c.getContext("2d"); g.clearRect(0, 0, W, H);
      const cols = 60, rows = 8, hist = mind.history.slice(-cols * 2);
      for (let i = 0; i < cols; i++) {
        const h = hist[Math.floor(i * hist.length / cols)], v = h ? Math.min(1, Math.max(h.v / 8, h.a / 8)) : 0;
        for (let r = 0; r < rows; r++) {
          const lit = (rows - r) / rows <= v + 0.001 && v > 0.05, x = (i + 0.5) * W / cols, y = (r + 0.5) * H / rows;
          g.fillStyle = lit ? "rgba(235,255,240,0.95)" : "rgba(255,255,255,0.13)"; g.beginPath(); g.arc(x, y, (lit ? 1.6 : 1) * dpr, 0, 7); g.fill();
        }
      }
    };
    draw(); return () => cancelAnimationFrame(raf);
  }, [mind]);
  const pct = mind.tries ? Math.round(100 * mind.hits / mind.tries) : null;
  return (
    <section className="card card-green" aria-label="Predictions">
      <header className="card-head"><div><small className="eyebrow">Sound → sight</small><h2>Predictions right</h2></div>
        <span className="big-num mono">{pct === null ? "—" : `${pct}%`}<small>{mind.tries ? `${mind.hits} of ${mind.tries}` : "none made yet"}</small></span></header>
      <div className="dotfield"><canvas ref={ref} /></div>
      <div className="axis light"><span>older</span><span>surprise over the last minute</span><span>now</span></div>
    </section>
  );
}

export function LogCard({mind}) {
  const items = mind.log.slice(-40).reverse();
  return (
    <section className="card log-card" aria-label="Latest from its mind">
      <header className="card-head"><div><h2>Latest from its mind</h2><p>What it noticed, learned and got right or wrong.</p></div></header>
      <ol className="log">{items.length ? items.map(l => <li key={l.id} className={`log-${l.kind}`}><span className="mono">{fmtTime(l.at)}</span>{l.text}</li>) : <li className="empty">Quiet so far.</li>}</ol>
    </section>
  );
}
const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
export {fmtTime};
