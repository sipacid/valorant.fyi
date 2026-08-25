(function (VF) {
  "use strict";

  const MUTE_KEY = "muted";
  let muted = VF.store.read(MUTE_KEY, false);

  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function playTick(time, frequency, duration = 0.04, volume = 0.08) {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + duration);
  }

  function playImpact(time) {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.35);
    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.4);
  }

  function playNote(time, frequency, duration, volume = 0.06) {
    const ctx = getAudioContext();
    if (!ctx || !frequency) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = frequency;
    // Slower attack/release than playTick — this has to read as a tune, not a UI blip.
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.02);
    gain.gain.setValueAtTime(volume, time + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + duration);
  }

  /**
   * "Never gonna give you up" — the chorus, as [frequency, beats]. Synthesized
   * rather than shipped as an mp3 so the site keeps working from file:// and
   * stays free of binary assets. 0 is a rest.
   */
  const BEAT = 0.26;
  const RICKROLL = (() => {
    const N = {
      D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0,
      Bb4: 466.16, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46,
    };
    return [
      // Never gonna give you up
      [N.G4, 1], [N.A4, 1], [N.C5, 1], [N.A4, 1],
      [N.E5, 3], [N.E5, 3], [N.D5, 4], [0, 2],
      // Never gonna let you down
      [N.G4, 1], [N.A4, 1], [N.C5, 1], [N.A4, 1],
      [N.D5, 3], [N.D5, 3], [N.C5, 2], [N.Bb4, 1], [N.A4, 1], [0, 2],
      // Never gonna run around and desert you
      [N.G4, 1], [N.A4, 1], [N.C5, 1], [N.A4, 1],
      [N.C5, 4], [N.D5, 2], [N.Bb4, 3], [N.A4, 1], [N.G4, 2], [0, 1],
      [N.G4, 1], [N.D5, 4], [N.C5, 6], [0, 4],
    ];
  })();

  let rickrollTimer = null;

  /** Schedules one pass of the melody and returns how long it runs, in seconds. */
  function scheduleRickroll() {
    const ctx = getAudioContext();
    if (!ctx) return 0;
    let at = ctx.currentTime + 0.05;
    for (const [freq, beats] of RICKROLL) {
      const duration = beats * BEAT;
      playNote(at, freq, duration);
      at += duration;
    }
    return at - ctx.currentTime;
  }

  /**
   * Loops the chorus until the page is reloaded. Idempotent. Used by the
   * score-tampering gag — see VF.tamper.
   */
  function rickroll() {
    if (rickrollTimer || muted) return;
    const start = () => {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        // Autoplay policy: no user gesture yet, so try again on their next click.
        document.addEventListener("click", start, { once: true });
        return;
      }
      const seconds = scheduleRickroll();
      if (!seconds) return;
      rickrollTimer = setInterval(scheduleRickroll, seconds * 1000);
    };
    start();
  }

  function scheduleSpinSound(durationMs) {
    if (muted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const startAt = ctx.currentTime;
    const totalSec = durationMs / 1000;
    const tickCount = 16;
    for (let i = 0; i < tickCount; i++) {
      const p = (i + 0.5) / tickCount;
      const t = 1 - Math.pow(1 - p, 2.6);
      const freq = 720 - p * 380;
      playTick(startAt + t * totalSec, freq);
    }
    playImpact(startAt + totalSec);
  }

  function cue(kind) {
    if (muted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (kind === "impact") {
      playImpact(now);
    } else if (kind === "mark") {
      playTick(now, 880, 0.05, 0.1);
    } else if (kind === "complete") {
      playTick(now, 660, 0.06, 0.1);
      playTick(now + 0.07, 990, 0.08, 0.1);
    } else if (kind === "skip") {
      playTick(now, 340, 0.08, 0.07);
    }
  }

  VF.audio = {
    getAudioContext,
    playTick,
    playImpact,
    rickroll,
    scheduleSpinSound,
    cue,
    isMuted: () => muted,
    setMuted(value) {
      muted = Boolean(value);
      VF.store.write(MUTE_KEY, muted);
      return muted;
    },
  };
})(window.VF);
