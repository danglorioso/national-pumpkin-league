"use client";

// Tiny synthesized sound kit for the TV. Every call is a no-op until enableSound()
// has run inside a user gesture, which is what browsers require to start audio.

let ctx: AudioContext | null = null;

export function enableSound() {
  ctx ??= new AudioContext();
  void ctx.resume();
}

function tone(
  freq: number,
  at: number,
  dur: number,
  { type = "square", gain = 0.12, to }: { type?: OscillatorType; gain?: number; to?: number } = {},
) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(at: number, dur: number, gain: number) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  const amp = ctx.createGain();
  src.buffer = buffer;
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(amp).connect(ctx.destination);
  src.start(t);
}

export const sfx = {
  /** A player locked in. */
  blip() {
    tone(660, 0, 0.08, { gain: 0.08 });
    tone(990, 0.07, 0.12, { gain: 0.08 });
  },
  /** Opening bell: the market is open. */
  bell() {
    for (let i = 0; i < 3; i++) {
      tone(1568, i * 0.28, 0.5, { type: "triangle", gain: 0.2 });
      tone(2349, i * 0.28, 0.35, { type: "sine", gain: 0.08 });
    }
  },
  /** Snare roll that tightens over `seconds`. */
  drumroll(seconds: number) {
    for (let t = 0; t < seconds; t += 0.055 - 0.02 * (t / seconds)) {
      noise(t, 0.05, 0.06 + 0.1 * (t / seconds));
    }
  },
  airhorn() {
    for (const at of [0, 0.22, 0.44]) {
      const long = at === 0.44;
      for (const f of [466, 587, 698]) {
        tone(f, at, long ? 0.9 : 0.16, { type: "sawtooth", gain: 0.07 });
      }
    }
  },
  /** Womp womp womp wommmp. */
  trombone() {
    [311, 293, 277].forEach((f, i) => tone(f, i * 0.42, 0.38, { type: "sawtooth", gain: 0.1, to: f * 0.97 }));
    tone(262, 1.26, 1.1, { type: "sawtooth", gain: 0.1, to: 196 });
  },
  kaching() {
    noise(0, 0.08, 0.12);
    tone(1319, 0.06, 0.12, { type: "triangle", gain: 0.15 });
    tone(1760, 0.16, 0.5, { type: "triangle", gain: 0.15 });
  },
  siren() {
    for (let i = 0; i < 3; i++) {
      tone(520, i * 0.5, 0.25, { type: "sawtooth", gain: 0.09, to: 880 });
      tone(880, i * 0.5 + 0.25, 0.25, { type: "sawtooth", gain: 0.09, to: 520 });
    }
  },
  fanfare() {
    const notes: [number, number, number][] = [
      [523, 0, 0.18], [523, 0.18, 0.18], [523, 0.36, 0.18], [659, 0.54, 0.4],
      [587, 0.98, 0.18], [659, 1.16, 0.18], [784, 1.34, 1.2],
    ];
    for (const [f, at, dur] of notes) {
      tone(f, at, dur, { type: "sawtooth", gain: 0.09 });
      tone(f / 2, at, dur, { type: "square", gain: 0.05 });
    }
  },
};

export function buzz(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
}
