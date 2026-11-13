import React from "react";
import {Eye, Ear, Crosshair, Shapes, AudioLines, Link2, Moon} from "lucide-react";
import {ago} from "../useMind.js";

// How it thinks, as a live node graph. Links glow when a signal just passed along them.
const NODES = [
  {id: "eye", x: 70, y: 70, icon: Eye, title: "Eye", sub: "Learns what is usual"},
  {id: "attention", x: 330, y: 70, icon: Crosshair, title: "Attention", sub: "Goes to surprises"},
  {id: "things", x: 590, y: 70, icon: Shapes, title: "Things", sub: "Remembers sights"},
  {id: "ear", x: 70, y: 210, icon: Ear, title: "Ear", sub: "Learns usual sound"},
  {id: "sounds", x: 330, y: 210, icon: AudioLines, title: "Sounds", sub: "Remembers sounds"},
  {id: "links", x: 590, y: 210, icon: Link2, title: "Links", sub: "Sound predicts sight"},
  {id: "sleep", x: 850, y: 140, icon: Moon, title: "Sleep", sub: "Merges and tidies"},
];
const W = 160, H = 64;
const EDGES = [
  {from: "eye", to: "attention", label: "surprise", pulse: "eye"},
  {from: "attention", to: "things", label: "sight", pulse: "things"},
  {from: "ear", to: "sounds", label: "sound", pulse: "ear"},
  {from: "sounds", to: "links", label: "prediction", pulse: "predict"},
  {from: "things", to: "links", label: "seen with", pulse: "links", vertical: true},
  {from: "things", to: "sleep", label: "replay", pulse: "sleep"},
  {from: "links", to: "sleep", label: "replay", pulse: "sleep"},
];

export default function MindGraph({mind, pulses}) {
  const p = pulses.current, byId = Object.fromEntries(NODES.map(n => [n.id, n]));
  const known = mind.things.filter(t => t.count > 1).length;
  const counts = {
    eye: mind.frames ? `${mind.visSurprise.toFixed(1)}σ` : "–", attention: mind.focus.active ? "focused" : "resting",
    things: `${known} known`, ear: mind.audioFrames ? `${mind.audSurprise.toFixed(1)}σ` : "–",
    sounds: `${mind.sounds.length} known`, links: mind.tries ? `${mind.hits}/${mind.tries} right` : "learning", sleep: `${mind.stats.sleeps} naps`,
  };
  return (
    <section className="card graph-card" aria-label="How it thinks">
      <header className="card-head"><div><h2>How it thinks</h2><p>Each box learns on its own. Lines light up when a signal passes.</p></div></header>
      <svg viewBox="0 0 1040 290" className="graph" role="img" aria-label="Eye and ear feed attention and memory, which feed links and sleep">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <linearGradient id="wire" x1="0" x2="1"><stop offset="0" stopColor="#5dff8a" stopOpacity=".9" /><stop offset="1" stopColor="#5dff8a" stopOpacity=".35" /></linearGradient>
        </defs>
        {EDGES.map(e => {
          const a = byId[e.from], b = byId[e.to], hot = ago(p[e.pulse], 900);
          const [x1, y1, x2, y2] = e.vertical ? [a.x + W / 2, a.y + H, b.x + W / 2, b.y] : [a.x + W, a.y + H / 2, b.x, b.y + H / 2];
          const d = e.vertical ? `M${x1} ${y1} C${x1} ${y1 + 40} ${x2} ${y2 - 40} ${x2} ${y2}` : `M${x1} ${y1} C${x1 + 60} ${y1} ${x2 - 60} ${y2} ${x2} ${y2}`;
          const mx = (x1 + x2) / 2 + (e.vertical ? 34 : 0), my = (y1 + y2) / 2;
          return (
            <g key={e.from + e.to} className={`edge${hot ? " hot" : ""}`}>
              <path d={d} className="edge-base" />
              <path d={d} className="edge-glow" filter="url(#glow)" />
              <path d={d} className="edge-flow" />
              <circle cx={x1} cy={y1} r="3" className="port" /><circle cx={x2} cy={y2} r="3" className="port" />
              <g transform={`translate(${mx} ${my})`}><rect x="-34" y="-10" width="68" height="20" rx="10" className="edge-label-bg" /><text className="edge-label" textAnchor="middle" dy="4">{e.label}</text></g>
            </g>
          );
        })}
        {NODES.map(n => {
          const Icon = n.icon, hot = ago(p[n.id], 900) || (n.id === "links" && ago(p.links, 900));
          return (
            <g key={n.id} transform={`translate(${n.x} ${n.y})`} className={`node${hot ? " hot" : ""}`}>
              <rect x="-5" y="-5" width={W + 10} height={H + 10} rx="18" className="node-frame" />
              <rect width={W} height={H} rx="14" className="node-body" />
              <foreignObject x="0" y="0" width={W} height={H}>
                <div className="node-inner">
                  <span className="node-icon"><Icon size={18} strokeWidth={1.6} /></span>
                  <span className="node-text"><b>{n.title}</b><small>{counts[n.id]}</small></span>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
