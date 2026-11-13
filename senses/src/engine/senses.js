// Inputs: the camera and microphone, or a small demo world with shapes and sounds.
import {HW, HH} from "./mind.js";

export class Senses {
  constructor(mind) { this.mind = mind; this.mode = null; this.timer = null; this.muted = true; }

  async startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {width: {ideal: 640}, height: {ideal: 480}, facingMode: "user"},
      audio: {echoCancellation: false, noiseSuppression: false, autoGainControl: false},
    });
    this.stop();
    this.stream = stream;
    const video = document.createElement("video"); video.playsInline = true; video.muted = true; video.srcObject = stream; await video.play();
    this.video = video;
    this.ctx = new AudioContext();
    this.analyser = this.makeAnalyser();
    if (stream.getAudioTracks().length) this.ctx.createMediaStreamSource(stream).connect(this.analyser);
    this.out.gain.value = 0; // never play the microphone back
    this.mode = "camera";
    // Mirror the picture so it moves like a mirror; everything downstream sees the mirrored frame.
    this.draw = g => { g.save(); g.translate(HW, 0); g.scale(-1, 1); g.drawImage(video, 0, 0, HW, HH); g.restore(); };
    this.mind.resetPerception();
    this.mind.say("Camera and microphone on. Everything is new to it, so give it a few seconds to learn the room.", "start");
    this.run();
  }

  startDemo() {
    this.stop();
    this.ctx = new AudioContext();
    this.analyser = this.makeAnalyser();
    this.out.gain.value = this.muted ? 0 : 0.25;
    this.mode = "demo";
    const demo = makeDemo(this);
    this.draw = g => demo.draw(g);
    this.mind.resetPerception();
    this.mind.say("Demo world on. A red ball bounces with a thud, a blue square appears with a beep, and a green triangle appears in silence.", "start");
    this.run();
  }

  makeAnalyser() {
    const a = this.ctx.createAnalyser(); a.fftSize = 2048; a.smoothingTimeConstant = 0.4;
    this.out = this.ctx.createGain(); a.connect(this.out).connect(this.ctx.destination);
    return a;
  }

  setMuted(m) { this.muted = m; if (this.out && this.mode === "demo") this.out.gain.value = m ? 0 : 0.25; }

  run() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.mind.step(this.draw, this.analyser, this.ctx ? this.ctx.sampleRate : 48000), 66);
  }

  stop() {
    clearInterval(this.timer); this.timer = null;
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.ctx) this.ctx.close();
    if (this.mode) this.mind.say("Senses off. It keeps what it learned until you clear it or close the tab.", "stop");
    this.stream = null; this.ctx = null; this.analyser = null; this.video = null; this.mode = null;
  }

  beep(freq, dur) {
    if (!this.ctx) return; const o = this.ctx.createOscillator(), g = this.ctx.createGain(), t = this.ctx.currentTime;
    o.frequency.value = freq; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.02); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(this.analyser); o.start(t); o.stop(t + dur + 0.05);
  }
  thud(dur) {
    if (!this.ctx) return; const n = Math.floor(this.ctx.sampleRate * dur), buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = "lowpass"; f.frequency.value = 600; g.gain.value = 1.2; s.buffer = buf; s.connect(f).connect(g).connect(this.analyser); s.start();
  }
}

function makeDemo(senses) {
  const d = {ball: {x: 60, y: 60, vx: 3.2, vy: 0}, square: null, tri: null, nextSquare: 3000, nextTri: 6500, t0: performance.now()};
  d.draw = g => {
    const t = performance.now() - d.t0;
    g.fillStyle = "#151816"; g.fillRect(0, 0, HW, HH);
    g.fillStyle = "#1f2420"; for (let i = 0; i < 8; i++) g.fillRect(i * 40, 200, 20, 40);
    const b = d.ball; b.vy += 0.5; b.x += b.vx; b.y += b.vy;
    if (b.x < 12 || b.x > HW - 12) { b.vx = -b.vx; b.x = Math.max(12, Math.min(HW - 12, b.x)); }
    if (b.y > 188) { b.y = 188; b.vy = -Math.abs(b.vy) * 0.92; if (Math.abs(b.vy) < 6) b.vy = -9.5; senses.thud(0.07); }
    g.fillStyle = "#d9433b"; g.beginPath(); g.arc(b.x, b.y, 12, 0, 7); g.fill();
    if (t > d.nextSquare) { d.square = {x: 40 + Math.random() * 220, y: 30 + Math.random() * 120, until: t + 1300}; d.nextSquare = t + 5500 + Math.random() * 2500; senses.beep(880, 0.35); }
    if (d.square) { if (t > d.square.until) d.square = null; else { g.fillStyle = "#3b6fd8"; g.fillRect(d.square.x, d.square.y, 34, 34); } }
    if (t > d.nextTri) { d.tri = {x: 40 + Math.random() * 220, y: 40 + Math.random() * 110, until: t + 1500}; d.nextTri = t + 8000 + Math.random() * 3000; }
    if (d.tri) { if (t > d.tri.until) d.tri = null; else { g.fillStyle = "#3fa34d"; g.beginPath(); g.moveTo(d.tri.x, d.tri.y + 36); g.lineTo(d.tri.x + 20, d.tri.y); g.lineTo(d.tri.x + 40, d.tri.y + 36); g.fill(); } }
  };
  return d;
}
