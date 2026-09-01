/* Efeitos sonoros sintetizados com WebAudio — sem arquivos externos. */

const MUTE_KEY = "cobrinha:mudo";

let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = localStorage.getItem(MUTE_KEY) === "1";
} catch {
  muted = false;
}

function ac(): AudioContext | null {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

type Wave = OscillatorType;

function tone(
  c: AudioContext,
  f0: number,
  dur: number,
  type: Wave,
  vol: number,
  f1?: number,
  delay = 0
) {
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(30, f0), t0);
  if (f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  unlock() {
    ac();
  },
  isMuted() {
    return muted;
  },
  toggleMuted() {
    muted = !muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      /* sem storage */
    }
    return muted;
  },
  click() {
    if (muted) return;
    const c = ac();
    if (!c) return;
    tone(c, 620, 0.07, "triangle", 0.22, 880);
  },
  start() {
    if (muted) return;
    const c = ac();
    if (!c) return;
    tone(c, 392, 0.1, "square", 0.16);
    tone(c, 587, 0.14, "square", 0.16, undefined, 0.09);
  },
  eat(combo: number) {
    if (muted) return;
    const c = ac();
    if (!c) return;
    const f = 500 * Math.pow(1.1, Math.min(combo, 6));
    tone(c, f, 0.09, "square", 0.2, f * 1.5);
    tone(c, f * 2, 0.06, "sine", 0.1, f * 2.4, 0.02);
  },
  bonusSpawn() {
    if (muted) return;
    const c = ac();
    if (!c) return;
    tone(c, 980, 0.08, "sine", 0.14, 1400);
  },
  bonus() {
    if (muted) return;
    const c = ac();
    if (!c) return;
    [660, 880, 1320].forEach((f, i) => tone(c, f, 0.1, "triangle", 0.2, undefined, i * 0.06));
  },
  die() {
    if (muted) return;
    const c = ac();
    if (!c) return;
    tone(c, 320, 0.5, "sawtooth", 0.22, 55);
    tone(c, 160, 0.4, "square", 0.14, 45, 0.05);
  },
  pause() {
    if (muted) return;
    const c = ac();
    if (!c) return;
    tone(c, 520, 0.09, "triangle", 0.18, 360);
  },
  resume() {
    if (muted) return;
    const c = ac();
    if (!c) return;
    tone(c, 360, 0.09, "triangle", 0.18, 540);
  },
  record() {
    if (muted) return;
    const c = ac();
    if (!c) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      tone(c, f, 0.14, "triangle", 0.2, undefined, i * 0.09)
    );
  },
};
