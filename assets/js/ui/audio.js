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
