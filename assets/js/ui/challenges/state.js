// state.js — run persistence and the bits every challenge mode shares.

(function (VF) {
  "use strict";

  const RUN_KEY = "challenges/run";
  const PREFS_KEY = "challenges/prefs";
  // 2 came with the `tier` seed field. Saved runs from before it hold seeds in
  // the old layout, so they're dropped rather than misread.
  const STATE_VERSION = 2;

  const DEFAULT_PREFS = {
    mode: "bingo",
    agentMode: 0,
    diffMask: 0b1111,
    tier: 1, // medium
    opts: VF.seed.OPT_FREE_CENTER,
  };

  /**
   * How much of a card each difficulty should take up, 1★ → 4★.
   *
   * Separate from `diffMask`, which decides what's *eligible*. The mask is a
   * filter; the tier is the mix. On a 25-tile card Easy lands a single 4★,
   * Very Hard is about 60% of them.
   */
  const TIERS = [
    { id: "easy", label: "Easy", weights: [0.4, 0.4, 0.16, 0.04] },
    { id: "medium", label: "Medium", weights: [0.2, 0.36, 0.32, 0.12] },
    { id: "hard", label: "Hard", weights: [0.08, 0.2, 0.36, 0.36] },
    { id: "brutal", label: "Very Hard", weights: [0.0, 0.08, 0.32, 0.6] },
  ];

  const tierAt = (index) => TIERS[index] ?? TIERS[1];

  function loadPrefs() {
    const stored = VF.store.read(PREFS_KEY, {});
    const prefs = { ...DEFAULT_PREFS, ...stored };
    if (!VF.seed.MODES.includes(prefs.mode)) prefs.mode = DEFAULT_PREFS.mode;
    if (!prefs.diffMask) prefs.diffMask = DEFAULT_PREFS.diffMask;
    if (!(prefs.tier >= 0 && prefs.tier < TIERS.length)) prefs.tier = DEFAULT_PREFS.tier;
    return prefs;
  }

  const savePrefs = (prefs) => VF.store.write(PREFS_KEY, prefs);

  function loadRun() {
    const run = VF.store.read(RUN_KEY, null);
    if (!run || run.v !== STATE_VERSION) return null;
    if (!VF.seed.MODES.includes(run.mode)) return null;
    return run;
  }

  function saveRun(state) {
    state.updatedAt = Date.now();
    VF.store.write(RUN_KEY, state);
    return state;
  }

  const clearRun = () => VF.store.remove(RUN_KEY);

  /**
   * Looks up a challenge id and renders its text for whichever agent this run is
   * locked to. Returns a placeholder rather than throwing if an id has since
   * been removed from the catalog, so an old saved run still displays.
   */
  function entryFor(state, id) {
    if (id === "FREE") {
      return { id, text: "FREE", kind: "objective", difficulty: 1, points: 0, scope: "round", free: true };
    }
    const entry =
      VF.catalog.get(id) || VF.pool.getCustom().find((e) => e.id === id) || null;
    if (!entry) {
      return { id, text: "(challenge no longer available)", kind: "objective", difficulty: 1, points: 0, scope: "match", missing: true };
    }
    const agent = state.agent ? VF.AGENTS_BY_TITLE.get(state.agent) : null;
    return { ...entry, text: VF.catalog.renderChallengeText(entry, agent) };
  }

  /**
   * Splits `count` across the four difficulties according to a tier's weights.
   *
   * Two things this has to get right:
   *  - **Renormalising.** If 4★ is filtered out but the tier is Hard, its 36%
   *    has nowhere to go. Redistributing across what's left keeps a Hard card
   *    hard instead of quietly coming up short.
   *  - **Exact totals.** Rounding each weight independently drifts off `count`,
   *    so leftovers go by largest remainder.
   *
   * @param {number[]} available how many entries exist at each difficulty
   * @returns {number[]} how many to take from each, summing to <= count
   */
  function allocateQuota(available, count, weights) {
    const live = weights.map((w, i) => (available[i] > 0 ? w : 0));
    const total = live.reduce((a, b) => a + b, 0);
    if (total <= 0) return available.map(() => 0);

    const exact = live.map((w) => (w / total) * count);
    const quota = exact.map((v, i) => Math.min(available[i], Math.floor(v)));

    // Largest remainder first, then round-robin. Two passes: the tier's own
    // difficulties get filled up before we fall back to ones it gave zero
    // weight, so a Very Hard card only reaches for 1-stars if nothing else is
    // left. Deterministic — fixed index order, no rng.
    //
    // Loops rather than making a fixed number of passes because a bucket can be
    // capped by how many challenges actually exist at that difficulty, and the
    // leftover then has to spill somewhere. With one pass per bucket the card
    // came up short whenever the pool was lopsided.
    let spare = count - quota.reduce((a, b) => a + b, 0);
    const order = exact
      .map((v, i) => ({ i, remainder: v - Math.floor(v) }))
      .sort((a, b) => b.remainder - a.remainder || a.i - b.i);

    for (const preferredOnly of [true, false]) {
      let placed = true;
      while (spare > 0 && placed) {
        placed = false;
        for (const { i } of order) {
          if (spare <= 0) break;
          if (quota[i] >= available[i]) continue;
          if (preferredOnly && live[i] === 0) continue;
          quota[i] += 1;
          spare -= 1;
          placed = true;
        }
      }
    }
    return quota;
  }

  /**
   * Picks `count` entries with the tier's difficulty mix applied.
   *
   * Consumes `rng` in a fixed order — buckets 1★ through 4★, then the top-up —
   * so two clients on one seed build the identical card.
   */
  function pickEntries(entries, count, rng, options) {
    const tier = tierAt(options && options.tier);
    const buckets = [1, 2, 3, 4].map((d) => entries.filter((e) => e.difficulty === d));
    const quota = allocateQuota(
      buckets.map((b) => b.length),
      count,
      tier.weights,
    );

    const picked = [];
    const taken = new Set();
    buckets.forEach((bucket, i) => {
      for (const entry of VF.rng.seededSample(bucket, quota[i], rng)) {
        picked.push(entry);
        taken.add(entry.id);
      }
    });

    // A tier can't always be honoured — a narrow pool may not hold enough of the
    // difficulties it wants. Top up from whatever is left so the card is always
    // full, even if it drifts off the requested mix.
    if (picked.length < count) {
      const rest = entries.filter((e) => !taken.has(e.id));
      picked.push(...VF.rng.seededSample(rest, count - picked.length, rng));
    }

    return VF.rng.seededShuffle(picked, rng);
  }

  /** Difficulty pip + points, used by every mode. */
  function metaRow(entry) {
    return VF.el("div", { class: "challenge-meta" }, [
      VF.el("span", {
        class: `difficulty-pip difficulty-pip--${entry.difficulty}`,
        "aria-label": `Difficulty ${entry.difficulty} of 4`,
        title: `Difficulty ${entry.difficulty} of 4`,
      }),
      VF.el("span", {
        class: "challenge-scope",
        textContent: entry.scope === "round" ? "ONE ROUND" : "MATCH",
      }),
      VF.el("span", { class: "challenge-points", textContent: `${entry.points} pts` }),
    ]);
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = String(Math.floor(total / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  VF.runState = {
    STATE_VERSION,
    DEFAULT_PREFS,
    TIERS,
    tierAt,
    allocateQuota,
    loadPrefs,
    savePrefs,
    loadRun,
    saveRun,
    clearRun,
    entryFor,
    pickEntries,
    metaRow,
    formatDuration,
  };
})(window.VF);
