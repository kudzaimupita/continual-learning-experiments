import React, {useEffect, useMemo, useState} from "react";
import {Camera, Box, Square, Moon, Trash2, Volume2, VolumeX, ScanEye, Eye} from "lucide-react";
import {Mind} from "./engine/mind.js";
import {Senses} from "./engine/senses.js";
import {useMindTick, usePulses} from "./useMind.js";
import Viewport from "./components/Viewport.jsx";
import MindGraph from "./components/MindGraph.jsx";
import {InnerViews, Spectrum, FocusCard, KnowledgePanel, PredictionCard, LogCard, fmtTime} from "./components/Panels.jsx";

export default function App() {
  const mind = useMemo(() => new Mind(), []);
  const senses = useMemo(() => new Senses(mind), [mind]);
  useMindTick(mind, 5);
  const pulses = usePulses(mind);
  const [showSurprise, setShowSurprise] = useState(true);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => () => senses.stop(), [senses]);
  useEffect(() => { window.mind = mind; window.senses = senses; }, [mind, senses]); // handy for testing from the console

  const startCamera = async () => {
    setError("");
    try { await senses.startCamera(); }
    catch (e) { setError(e && e.name === "NotAllowedError" ? "Camera or microphone access was blocked. Allow it in the browser's site settings, or try the demo world." : `Couldn't open the camera or microphone: ${e.message || e}`); }
  };
  const startDemo = () => { setError(""); senses.setMuted(muted); senses.startDemo(); };
  const live = !!senses.mode, elapsed = live ? Math.floor((performance.now() - mind.started) / 1000) : 0;
  const clear = () => { if (!confirmClear) { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3000); return; } mind.reset(); mind.say("Memory cleared. It starts again from nothing.", "stop"); setConfirmClear(false); };

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true" />
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true"><Eye size={18} strokeWidth={1.8} /></span>
          <div><b>Senses</b><small>A mind that learns from nothing</small></div>
        </div>
        <div className="crumbs">
          <span className={`status ${live ? "on" : ""}`}><span className={`dot${live ? " live" : ""}`} />{live ? "Awake" : "Asleep"}</span>
          <span className="pill">{senses.mode === "camera" ? "Camera and microphone" : senses.mode === "demo" ? "Demo world" : "No senses"}</span>
        </div>
        <div className="top-actions">
          <button className={`toggle ${showSurprise ? "on" : ""}`} onClick={() => setShowSurprise(s => !s)} aria-pressed={showSurprise}><ScanEye size={15} /> Surprise overlay</button>
        </div>
      </header>

      <main className="layout">
        <div className="col-left">
          <FocusCard mind={mind} />
          <InnerViews mind={mind} />
          <Spectrum mind={mind} live={live} />
        </div>
        <div className="col-center">
          <Viewport mind={mind} senses={senses} showSurprise={showSurprise} onCamera={startCamera} onDemo={startDemo} error={error} />
          <MindGraph mind={mind} pulses={pulses} />
          <LogCard mind={mind} />
        </div>
        <div className="col-right">
          <PredictionCard mind={mind} />
          <KnowledgePanel mind={mind} />
        </div>
      </main>

      <nav className="dock" aria-label="Controls">
        <div className="dock-group">
          <button className={`dock-btn${senses.mode === "camera" ? " active" : ""}`} onClick={startCamera}><Camera size={15} /> Camera</button>
          <button className={`dock-btn${senses.mode === "demo" ? " active" : ""}`} onClick={startDemo}><Box size={15} /> Demo world</button>
        </div>
        <span className="dock-sep" />
        <span className={`clock mono${live ? " on" : ""}`}>{fmtTime(elapsed)}<span className={`dot${live ? " live" : ""}`} /></span>
        <span className="dock-sep" />
        <div className="dock-group">
          <button className="icon-btn" onClick={() => senses.stop()} disabled={!live} aria-label="Stop senses" title="Stop"><Square size={15} /></button>
          <button className="icon-btn" onClick={() => mind.sleep("You put it to sleep.")} disabled={!live} aria-label="Sleep now" title="Sleep now"><Moon size={15} /></button>
          <button className="icon-btn" onClick={() => { setMuted(m => { senses.setMuted(!m); return !m; }); }} aria-label={muted ? "Unmute demo sounds" : "Mute demo sounds"} title={muted ? "Demo sounds muted" : "Demo sounds on"}>{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
          <button className={`icon-btn danger${confirmClear ? " confirm" : ""}`} onClick={clear} aria-label={confirmClear ? "Click again to clear memory" : "Clear memory"} title={confirmClear ? "Click again to clear" : "Clear memory"}><Trash2 size={15} />{confirmClear && <span className="confirm-text">Clear?</span>}</button>
        </div>
      </nav>
    </div>
  );
}
