import React, {useEffect, useRef} from "react";
import {Camera, Sparkles} from "lucide-react";
import {VW, VH, HW, HH, N, displayName} from "../engine/mind.js";

// The camera view with a telemetry overlay: surprise glow, attention reticle, readouts.
export default function Viewport({mind, senses, showSurprise, onCamera, onDemo, error}) {
  const ref = useRef(null), heat = useRef(null);
  useEffect(() => {
    heat.current = document.createElement("canvas"); heat.current.width = VW; heat.current.height = VH;
    let raf;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = ref.current; if (!c) return;
      const dpr = window.devicePixelRatio || 1, W = Math.round(c.clientWidth * dpr), H = Math.round(c.clientHeight * dpr);
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      const g = c.getContext("2d"); g.clearRect(0, 0, W, H);
      if (!senses.mode) return;
      // Fit the 4:3 frame inside the view, cropping like "cover".
      const s = Math.max(W / HW, H / HH), fw = HW * s, fh = HH * s, ox = (W - fw) / 2, oy = (H - fh) / 2;
      g.imageSmoothingEnabled = true; g.drawImage(mind.hi, ox, oy, fw, fh);
      g.fillStyle = "rgba(4,8,5,0.28)"; g.fillRect(0, 0, W, H); // slight dim so the overlay reads
      if (mind.frames > 25 && showSurprise) {
        const hc = heat.current, hg = hc.getContext("2d"), img = hg.createImageData(VW, VH);
        for (let i = 0; i < N; i++) { const z = mind.zs[i]; img.data[i * 4] = 90; img.data[i * 4 + 1] = 255; img.data[i * 4 + 2] = 130; img.data[i * 4 + 3] = z > 2 ? Math.min(170, (z - 2) * 45) : 0; }
        hg.putImageData(img, 0, 0);
        g.save(); g.globalCompositeOperation = "screen"; g.filter = `blur(${6 * dpr}px)`; g.drawImage(hc, ox, oy, fw, fh); g.restore();
      }
      if (mind.focus.active && mind.frames > 25) {
        const b = mind.focusBox(), x = ox + b.x * s, y = oy + b.y * s, w = b.side * s, k = Math.min(18 * dpr, w / 4);
        g.strokeStyle = "#5dff8a"; g.lineWidth = 1.5 * dpr; g.shadowColor = "#3dff7a"; g.shadowBlur = 12 * dpr;
        g.beginPath();
        for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + w, 1, -1], [x + w, y + w, -1, -1]]) { g.moveTo(cx + dx * k, cy); g.lineTo(cx, cy); g.lineTo(cx, cy + dy * k); }
        g.stroke(); g.shadowBlur = 0;
        g.strokeStyle = "rgba(93,255,138,0.35)"; g.lineWidth = dpr; g.setLineDash([2 * dpr, 4 * dpr]); g.beginPath();
        g.moveTo(x + w / 2, 0); g.lineTo(x + w / 2, y); g.moveTo(x + w / 2, y + w); g.lineTo(x + w / 2, H);
        g.moveTo(0, y + w / 2); g.lineTo(x, y + w / 2); g.moveTo(x + w, y + w / 2); g.lineTo(W, y + w / 2); g.stroke(); g.setLineDash([]);
        g.fillStyle = "#5dff8a"; g.beginPath(); g.arc(x + w / 2, y + w / 2, 2.5 * dpr, 0, 7); g.fill();
        const cur = mind.current && performance.now() - mind.current.last < 1500 ? mind.current : null;
        if (cur) {
          const label = `${displayName(cur)} · seen ${cur.count}×`; g.font = `${12 * dpr}px Outfit, system-ui, sans-serif`;
          const tw = g.measureText(label).width + 16 * dpr, lx = Math.min(W - tw - 8 * dpr, x), ly = Math.max(8 * dpr, y - 30 * dpr);
          g.fillStyle = "rgba(10,20,12,0.72)"; roundRect(g, lx, ly, tw, 22 * dpr, 11 * dpr); g.fill();
          g.strokeStyle = "rgba(93,255,138,0.5)"; g.lineWidth = dpr; g.stroke();
          g.fillStyle = "#d9ffe3"; g.fillText(label, lx + 8 * dpr, ly + 15 * dpr);
        }
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [mind, senses, showSurprise]);

  const live = !!senses.mode, warming = live && mind.frames <= 25;
  return (
    <section className="viewport frame" aria-label="What it sees">
      <canvas ref={ref} className="viewport-canvas" />
      <div className="viewport-grid" aria-hidden="true" />
      {live && <>
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="chip chip-tl"><span className="dot live" />{senses.mode === "camera" ? "Camera" : "Demo world"} · 48 × 36 vision</div>
        <div className="chip chip-tr mono">{mind.visSurprise.toFixed(1)}<span className="unit">σ surprise</span></div>
        <div className="readouts">
          <Readout label="Attention" value={mind.focus.active ? `${Math.round(mind.focus.x)}, ${Math.round(mind.focus.y)}` : "resting"} />
          <Readout label="Hot spots" value={mind.hot ?? 0} />
          <Readout label="Frames" value={mind.frames} />
        </div>
        {warming && <div className="warming"><Sparkles size={16} /> Learning what this scene usually looks like…</div>}
      </>}
      {!live && (
        <div className="hero">
          <h1>Give it <em>senses</em>.</h1>
          <p>It starts knowing nothing. It learns what is usual, notices what is new, remembers things and sounds, and links them together.</p>
          <div className="hero-actions">
            <button className="btn btn-green" onClick={onCamera}><Camera size={16} /> Use camera and microphone</button>
            <button className="btn btn-glass" onClick={onDemo}>Try the demo world</button>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <p className="fine">Runs entirely in this tab. Nothing is recorded, saved or sent.</p>
        </div>
      )}
    </section>
  );
}

function Readout({label, value}) {
  return <div className="readout"><span>{label}</span><b className="mono">{value}</b></div>;
}

function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
