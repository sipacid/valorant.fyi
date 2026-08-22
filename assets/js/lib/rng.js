// rng.js — seeded pseudo-randomness.
//
// Math.random() can't be seeded, but a shared challenge card has to be
// byte-identical for everyone who opens the same link. So every draw that
// decides *content* runs through a PRNG keyed off the seed string, while
// everything decorative (card art, tilt, spin length, particles) stays on
// Math.random() — two players on one seed get the same challenges, their own art.

(function (VF) {
  "use strict";

  /** Hashes a string to a uint32 generator. xmur3. */
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  /** uint32 seed -> () => [0, 1). mulberry32. */
  function mulberry32(a) {
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rngFromString = (s) => mulberry32(xmur3(String(s))());

  const randInt = (rng, n) => Math.floor(rng() * n);

  /** Fisher-Yates, parameterized on the random source. */
  function seededShuffle(array, rng) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  const seededSample = (array, k, rng) => seededShuffle(array, rng).slice(0, k);

  VF.rng = {
    xmur3,
    mulberry32,
    rngFromString,
    randInt,
    seededShuffle,
    seededSample,
    /** The original unseeded shuffle, unchanged in behaviour. */
    shuffleArray: (array) => seededShuffle(array, Math.random),
  };
})(window.VF);
