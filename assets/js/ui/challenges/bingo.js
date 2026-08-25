// bingo.js — a seeded 5x5 card of objectives. The headline mode: everyone in a
// lobby opens the same link and races the same 25 tiles.

(function (VF) {
  "use strict";

  const SIZE = 5;
  const CELLS = SIZE * SIZE;
  const CENTER = 12;
  const LINE_BONUS = 100;
  const BLACKOUT_BONUS = 500;

  // 12 lines: 5 rows, 5 columns, 2 diagonals. 25 bits fits comfortably inside
  // JS's 32-bit bitwise range.
  const LINE_MASKS = (() => {
    const bit = (row, col) => 1 << (row * SIZE + col);
    const indices = [0, 1, 2, 3, 4];
    const masks = [];
    for (const r of indices) masks.push(indices.reduce((acc, c) => acc | bit(r, c), 0));
    for (const c of indices) masks.push(indices.reduce((acc, r) => acc | bit(r, c), 0));
    masks.push(indices.reduce((acc, i) => acc | bit(i, i), 0));
    masks.push(indices.reduce((acc, i) => acc | bit(i, SIZE - 1 - i), 0));
    return masks;
  })();

  const FULL = (1 << CELLS) - 1;

  const isMarked = (marks, i) => Boolean(marks & (1 << i));
  const toggleMark = (marks, i) => marks ^ (1 << i);
  const completedLines = (marks) => LINE_MASKS.filter((mask) => (marks & mask) === mask);
  const isBlackout = (marks) => (marks & FULL) === FULL;

  /**
   * How much of an agent-locked card is agent-flavoured. Two fifths, because at
   * a fifth "lock to my agent" bought you five tiles out of 25 and barely read
   * as a different mode.
   */
  const AGENT_TILE_SHARE = 0.4;

  /**
   * ...but never more than this fraction of the agent material available.
   *
   * The two cases are very different sizes. A local run has 22-39 entries for
   * the agent it's locked to, so it can spend freely. A *shared* locked card can
   * only use the 11 universal {slot} templates — agent-named tiles aren't
   * identical for every player on the link — and taking 10 of 11 would make
   * every shared locked card the same card.
   */
  const AGENT_POOL_SHARE = 0.6;

  /**
   * At most two tiles from any one catalog family. A 25-tile card that's a third
   * "get N <gun> kills in a round" is technically a fair draw and unplayable in
   * practice — see VF.runState.pickEntries.
   */
  const MAX_PER_FAMILY = 2;

  /**
   * On an agent-locked card, reserve a quota of slot-template tiles.
   *
   * Without this the draw is uniform, and since slot templates are a small
   * slice of the objective pool a locked card came up with *no* agent-specific
   * tiles at all about one time in five — which makes the mode look broken.
   *
   * Deterministic: every branch consumes `rng` in a fixed order, so two clients
   * on one seed still build the identical card.
   */
  function pickTiles(objectives, need, rng, opts, agentMode) {
    // One budget for the whole card: the two halves below draw separately but
    // must not each spend the family cap.
    const draw = { ...opts, maxPerFamily: MAX_PER_FAMILY, seen: new Map() };
    if (agentMode !== 1) return VF.runState.pickEntries(objectives, need, rng, draw);

    // Agent flavour now comes from two places: universal {slot} templates (the
    // only kind a shared card can carry) and the per-agent ability challenges
    // that a local run gets. Both count toward the quota.
    const isAgentFlavoured = (e) => e.slots.length > 0 || Boolean(e.agent);
    const slotted = objectives.filter(isAgentFlavoured);
    const rest = objectives.filter((e) => !isAgentFlavoured(e));
    const want = Math.min(
      Math.floor(slotted.length * AGENT_POOL_SHARE),
      Math.round(need * AGENT_TILE_SHARE),
    );
    if (!want) return VF.runState.pickEntries(objectives, need, rng, draw);

    // The tier applies to both halves, so reserving agent tiles doesn't quietly
    // soften a Hard card.
    const agentTiles = VF.runState.pickEntries(slotted, want, rng, draw);
    const filler = VF.runState.pickEntries(rest, need - agentTiles.length, rng, draw);
    return VF.rng.seededShuffle(agentTiles.concat(filler), rng);
  }

  function build({ seedStr, seed, pool, agent }) {
    const freeCenter = Boolean(seed.opts & VF.seed.OPT_FREE_CENTER);
    const need = freeCenter ? CELLS - 1 : CELLS;

    const objectives = pool.filter((e) => e.kind === "objective");
    if (objectives.length < need) return null;

    const rng = VF.seed.seedRng(seedStr, "bingo:tiles");
    const tiles = pickTiles(objectives, need, rng, seed, seed.agentMode).map((e) => e.id);
    if (freeCenter) tiles.splice(CENTER, 0, "FREE");

    return {
      v: VF.runState.STATE_VERSION,
      mode: "bingo",
      seed: seedStr,
      shared: Boolean(seed.shared),
      agent: agent ?? null,
      tiles,
      marks: freeCenter ? 1 << CENTER : 0,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  function score(state) {
    let points = 0;
    state.tiles.forEach((id, i) => {
      if (isMarked(state.marks, i)) points += VF.runState.entryFor(state, id).points;
    });
    return (
      points +
      completedLines(state.marks).length * LINE_BONUS +
      (isBlackout(state.marks) ? BLACKOUT_BONUS : 0)
    );
  }

  function render(root, state, api) {
    root.innerHTML = "";

    const scoreEl = VF.el("span", { class: "run-score-value" });
    const setScore = VF.tamper.watchScore(scoreEl);
    api.onTeardown(setScore.stop);
    const linesEl = VF.el("span", { class: "run-stat-value" });
    const header = VF.el("div", { class: "run-header" }, [
      VF.el("div", { class: "run-title" }, [
        VF.el("h2", { textContent: "Bingo" }),
        api.subtitle(state),
      ]),
      VF.el("div", { class: "run-stats" }, [
        VF.el("div", { class: "run-stat" }, [
          VF.el("span", { class: "run-stat-label", textContent: "Lines" }),
          linesEl,
        ]),
        VF.el("div", { class: "run-stat run-stat--score" }, [
          VF.el("span", { class: "run-stat-label", textContent: "Score" }),
          scoreEl,
        ]),
      ]),
    ]);

    const grid = VF.el("div", { class: "bingo-grid", role: "grid" });
    const tileEls = [];

    const agent = state.agent ? VF.AGENTS_BY_TITLE.get(state.agent) : null;

    state.tiles.forEach((id, index) => {
      const entry = VF.runState.entryFor(state, id);
      const tile = VF.el(
        "button",
        {
          type: "button",
          class: `bingo-tile${entry.free ? " bingo-tile--free" : ""}`,
          "aria-pressed": String(isMarked(state.marks, index)),
          dataset: { index: String(index) },
        },
        [
          // Sits behind the text and fills the empty lower half of the tile.
          entry.free || entry.missing ? null : VF.icons.render(entry, agent, "watermark"),
          VF.el("span", { class: "bingo-tile-text", textContent: entry.text }),
          entry.free
            ? null
            : VF.el("span", {
                class: `difficulty-pip difficulty-pip--${entry.difficulty}`,
                "aria-label": `Difficulty ${entry.difficulty} of 4`,
              }),
        ],
      );
      tile.classList.toggle("is-marked", isMarked(state.marks, index));
      if (!entry.free) {
        tile.addEventListener("click", () => mark(index));
      } else {
        tile.disabled = true;
      }
      tileEls.push(tile);
      grid.appendChild(tile);
    });

    let knownLines = completedLines(state.marks).length;

    function mark(index) {
      state.marks = toggleMark(state.marks, index);
      const marked = isMarked(state.marks, index);
      tileEls[index].classList.toggle("is-marked", marked);
      tileEls[index].setAttribute("aria-pressed", String(marked));
      api.save(state);
      sync();

      const lines = completedLines(state.marks);
      if (lines.length > knownLines) celebrate(lines);
      knownLines = lines.length;
      VF.audio.cue(marked ? "mark" : "skip");
    }

    function celebrate(lines) {
      const inLine = new Set();
      for (const mask of lines) {
        for (let i = 0; i < CELLS; i++) if (mask & (1 << i)) inLine.add(i);
      }
      for (const i of inLine) tileEls[i].classList.add("in-line");
      api.shake();
      VF.audio.cue("impact");
      if (isBlackout(state.marks)) api.flash("BLACKOUT");
      else api.flash("BINGO");
    }

    function sync() {
      setScore(score(state));
      const lines = completedLines(state.marks);
      linesEl.textContent = `${lines.length} / ${LINE_MASKS.length}`;
      const inLine = new Set();
      for (const mask of lines) {
        for (let i = 0; i < CELLS; i++) if (mask & (1 << i)) inLine.add(i);
      }
      tileEls.forEach((el, i) => el.classList.toggle("in-line", inLine.has(i)));
    }

    root.append(header, grid, api.footer(state));
    sync();
  }

  VF.modes = VF.modes || {};
  VF.modes.bingo = {
    label: "Bingo",
    blurb: "A 5x5 card of objectives. Same card for everyone on the link.",
    needs: (seed) => (seed.opts & VF.seed.OPT_FREE_CENTER ? CELLS - 1 : CELLS),
    kind: "objective",
    build,
    render,
    score,
    // exported for verification in the console
    LINE_MASKS,
    completedLines,
    isBlackout,
    toggleMark,
    isMarked,
  };
})(window.VF);
