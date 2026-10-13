"use client";

// Tiny synthesized sound kit for the TV. Every call is a no-op until enableSound()
// has run inside a user gesture, which is what browsers require to start audio.

let ctx: AudioContext | null = null;

export function enableSound() {
  ctx ??= new AudioContext();
  void ctx.resume();
  primeTrack();
  if (musicWanted) music.start();
}

type ToneOptions = { type?: OscillatorType; gain?: number; to?: number; out?: AudioNode };

function tone(
  freq: number,
  at: number,
  dur: number,
  { type = "square", gain = 0.12, to, out }: ToneOptions = {},
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
  osc.connect(amp).connect(out ?? ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(at: number, dur: number, gain: number, out?: AudioNode) {
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
  src.connect(amp).connect(out ?? ctx.destination);
  src.start(t);
}

// ---------- background music ----------
//
// Loops the audio file at MUSIC_SRC in the lobby and while voting is open. With
// no file there, a built-in loop plays instead.

const MUSIC_SRC = "/voting-music.mp3";
const MUSIC_VOLUME = 0.45;
const FADE_MS = 500;

let musicWanted = false;
let track: HTMLAudioElement | null = null;
let trackMissing = false;
let fading: ReturnType<typeof setInterval> | null = null;
let loop: { bus: GainNode; timer: ReturnType<typeof setInterval> } | null = null;

/** Creates the audio element inside the click that enables sound, so Safari lets it play later. */
function primeTrack() {
  if (track || trackMissing) return;
  const audio = new Audio(MUSIC_SRC);
  audio.loop = true;
  audio.preload = "auto";
  audio.addEventListener("error", () => {
    trackMissing = true;
    track = null;
    if (musicWanted) startLoop();
  });
  audio.muted = true;
  audio
    .play()
    .then(() => {
      if (!musicWanted) audio.pause();
      audio.muted = false;
    })
    .catch(() => {
      audio.muted = false;
    });
  track = audio;
}

function fadeTrack(to: number, done?: () => void) {
  const audio = track;
  if (!audio) return;
  if (fading) clearInterval(fading);
  const from = audio.volume;
  const started = Date.now();
  fading = setInterval(() => {
    const k = Math.min(1, (Date.now() - started) / FADE_MS);
    audio.volume = from + (to - from) * k;
    if (k < 1) return;
    if (fading) clearInterval(fading);
    fading = null;
    done?.();
  }, 40);
}

// The built-in loop: four bars in A minor, eighth notes at 132 bpm. 0 is a rest.
const STEP_S = 60 / 132 / 2;
const BASS = [
  110, 0, 164.81, 0, 110, 0, 164.81, 0,
  87.31, 0, 130.81, 0, 87.31, 0, 130.81, 0,
  73.42, 0, 110, 0, 73.42, 0, 110, 0,
  82.41, 0, 123.47, 0, 82.41, 0, 103.83, 123.47,
];
const LEAD = [
  440, 523.25, 659.25, 0, 622.25, 659.25, 0, 523.25,
  440, 523.25, 698.46, 0, 659.25, 698.46, 0, 523.25,
  440, 587.33, 698.46, 0, 659.25, 587.33, 0, 440,
  415.3, 493.88, 659.25, 0, 587.33, 493.88, 415.3, 0,
];

function loopStep(i: number, at: number, bus: GainNode) {
  const step = i % BASS.length;
  const secondPass = Math.floor(i / BASS.length) % 2 === 1;
  if (BASS[step]) tone(BASS[step], at, STEP_S * 0.9, { type: "triangle", gain: 0.16, out: bus });
  if (LEAD[step]) {
    tone(LEAD[step], at, STEP_S * 0.6, { type: secondPass ? "triangle" : "square", gain: secondPass ? 0.09 : 0.05, out: bus });
  }
  if (step % 4 === 0) tone(120, at, 0.12, { type: "sine", gain: 0.2, to: 45, out: bus });
  if (step % 2 === 1) noise(at, 0.03, 0.025, bus);
}

function startLoop() {
  if (!ctx || loop) return;
  const audio = ctx;
  const bus = audio.createGain();
  bus.gain.setValueAtTime(0, audio.currentTime);
  bus.gain.linearRampToValueAtTime(1, audio.currentTime + FADE_MS / 1000);
  bus.connect(audio.destination);
  let i = 0;
  let next = audio.currentTime + 0.1;
  // Notes are queued a little ahead on the audio clock so the beat never drifts.
  const schedule = () => {
    while (next < audio.currentTime + 0.3) {
      loopStep(i++, next - audio.currentTime, bus);
      next += STEP_S;
    }
  };
  schedule();
  loop = { bus, timer: setInterval(schedule, 100) };
}

function stopLoop() {
  if (!ctx || !loop) return;
  const { bus, timer } = loop;
  loop = null;
  clearInterval(timer);
  bus.gain.cancelScheduledValues(ctx.currentTime);
  bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
  bus.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_MS / 1000);
  setTimeout(() => bus.disconnect(), FADE_MS + 400);
}

export const music = {
  /** Safe to call before sound is enabled: it starts as soon as it can. */
  start() {
    musicWanted = true;
    if (!ctx) return;
    const audio = track;
    if (!audio) return startLoop();
    audio.currentTime = 0;
    audio.volume = 0;
    audio
      .play()
      .then(() => fadeTrack(MUSIC_VOLUME))
      .catch(() => {
        if (musicWanted) startLoop();
      });
  },
  stop() {
    musicWanted = false;
    stopLoop();
    const audio = track;
    if (audio) fadeTrack(0, () => audio.pause());
  },
};

export const sfx = {
  /** A player locked in. */
  blip() {
    tone(660, 0, 0.08, { gain: 0.08 });
    tone(990, 0.07, 0.12, { gain: 0.08 });
  },
  /** One beat of a countdown. */
  tick() {
    tone(880, 0, 0.12, { type: "triangle", gain: 0.14 });
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
  /** A flicked coin: ping, a flutter that slows, then the clink when it lands. */
  coinFlip(landsIn: number) {
    tone(2093, 0, 0.35, { type: "triangle", gain: 0.16 });
    for (let t = 0.12, gap = 0.07; t < landsIn; t += gap, gap *= 1.07) {
      tone(1320, t, 0.03, { gain: 0.03 });
    }
    noise(landsIn, 0.09, 0.14);
    tone(1568, landsIn + 0.02, 0.5, { type: "triangle", gain: 0.16 });
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
