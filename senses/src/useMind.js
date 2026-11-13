import {useEffect, useRef, useState} from "react";

// Re-render a few times a second with a fresh snapshot of the mind; the camera view draws itself every frame.
export function useMindTick(mind, hz = 5) {
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000 / hz); return () => clearInterval(id); }, [hz]);
  return mind;
}

// Remember when each kind of signal last flowed, so the graph can light up the right links.
export function usePulses(mind) {
  const pulses = useRef({});
  useEffect(() => mind.on(e => {
    const p = pulses.current, t = e.t;
    if (e.type === "sight") { p.eye = t; p.attention = t; p.things = t; if (e.isNew) p.newThing = t; }
    if (e.type === "sound") { p.ear = t; p.sounds = t; if (e.expects !== null) p.predict = t; }
    if (e.type === "prediction") { p.links = t; p[e.ok ? "right" : "wrong"] = t; }
    if (e.type === "sleep") p.sleep = t;
  }), [mind]);
  return pulses;
}

export const ago = (t, ms) => t && performance.now() - t < ms;
