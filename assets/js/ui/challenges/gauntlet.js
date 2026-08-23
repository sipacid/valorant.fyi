// gauntlet.js — race mode. One challenge at a time, most points in a match wins.
//
// The whole queue is generated up front from the seed rather than drawn one at a
// time, so everyone racing the same link sees the same sequence and a refresh
// mid-match resumes exactly where it left off.

(function (VF) {
  "use strict";

  const QUEUE_LEN = 40; // ~2 draws a round across a 25-round match

  function build({ seedStr, seed, pool, agent }) {
    const objectives = pool.filter((e) => e.kind === "objective");
    if (objectives.length < 5) return null;

    const rng = VF.seed.seedRng(seedStr, "gauntlet:queue");
    const queue = VF.runState
      .pickEntries(objectives, Math.min(QUEUE_LEN, objectives.length), rng, seed)
      .map((e) => e.id);

    return {
      v: VF.runState.STATE_VERSION,
      mode: "gauntlet",
      seed: seedStr,
      shared: Boolean(seed.shared),
      agent: agent ?? null,
      queue,
      cursor: 0,
      skipUsedOnCurrent: false,
      completed: [],
      skipped: [],
      score: 0,
      finished: false,
      startedAt: Date.now(),
      pausedAt: null,
      accumulatedMs: 0,
      updatedAt: Date.now(),
    };
  }

  const score = (state) => state.score;

  function elapsedMs(state) {
    if (state.pausedAt) return state.accumulatedMs;
    return state.accumulatedMs + (Date.now() - state.startedAt);
  }

  function advance(state) {
    state.cursor += 1;
    // Fresh skip budget only after you actually complete something.
    state.skipUsedOnCurrent = false;
    if (state.cursor >= state.queue.length) state.finished = true;
    return state;
  }

  function completeCurrent(state) {
    const id = state.queue[state.cursor];
    if (!id || state.finished) return state;
    const entry = VF.runState.entryFor(state, id);
    state.completed.push({ id, at: Date.now(), points: entry.points });
    state.score += entry.points;
    return advance(state);
  }

  /**
   * One skip per draw. The skipped challenge scores nothing, and — crucially —
   * `skipUsedOnCurrent` is NOT reset here, so the replacement can't be skipped
   * too. Without that you could burn the whole queue looking for a free 100.
   */
  function skipCurrent(state) {
    if (state.skipUsedOnCurrent || state.finished) return state;
    const id = state.queue[state.cursor];
    if (!id) return state;
    state.skipped.push(id);
    state.skipUsedOnCurrent = true;
    state.cursor += 1;
    if (state.cursor >= state.queue.length) state.finished = true;
    return state;
  }

  function render(root, state, api) {
    root.innerHTML = "";

    const scoreEl = VF.el("span", { class: "run-score-value" });
    const timerEl = VF.el("span", { class: "run-stat-value" });
    const doneEl = VF.el("span", { class: "run-stat-value" });

    const header = VF.el("div", { class: "run-header" }, [
      VF.el("div", { class: "run-title" }, [
        VF.el("h2", { textContent: "Gauntlet" }),
        api.subtitle(state),
      ]),
      VF.el("div", { class: "run-stats" }, [
        VF.el("div", { class: "run-stat" }, [
          VF.el("span", { class: "run-stat-label", textContent: "Time" }),
          timerEl,
        ]),
        VF.el("div", { class: "run-stat" }, [
          VF.el("span", { class: "run-stat-label", textContent: "Done" }),
          doneEl,
        ]),
        VF.el("div", { class: "run-stat run-stat--score" }, [
          VF.el("span", { class: "run-stat-label", textContent: "Score" }),
          scoreEl,
        ]),
      ]),
    ]);

    const cardEl = VF.el("div", { class: "gauntlet-card" });
    const completeBtn = VF.el("button", {
      type: "button",
      class: "gauntlet-action gauntlet-action--done",
      textContent: "Completed",
      onClick() {
        completeCurrent(state);
        api.save(state);
        VF.audio.cue("complete");
        api.shake();
        sync();
      },
    });
    const skipBtn = VF.el("button", {
      type: "button",
      class: "gauntlet-action gauntlet-action--skip",
      onClick() {
        skipCurrent(state);
        api.save(state);
        VF.audio.cue("skip");
        sync();
      },
    });
    const pauseBtn = VF.el("button", {
      type: "button",
      class: "gauntlet-action gauntlet-action--pause",
      onClick() {
        if (state.pausedAt) {
          state.startedAt = Date.now();
          state.pausedAt = null;
        } else {
          state.accumulatedMs = elapsedMs(state);
          state.pausedAt = Date.now();
        }
        api.save(state);
        sync();
      },
    });

    const actions = VF.el("div", { class: "gauntlet-actions" }, [completeBtn, skipBtn, pauseBtn]);
    const history = VF.el("ol", { class: "gauntlet-history" });

    function renderCard() {
      cardEl.innerHTML = "";
      if (state.finished) {
        const minutes = elapsedMs(state) / 60000;
        cardEl.append(
          VF.el("div", { class: "gauntlet-summary" }, [
            VF.el("h3", { textContent: "Run complete" }),
            VF.el("p", {
              class: "gauntlet-summary-score",
              textContent: `${state.score} points`,
            }),
            VF.el("p", {
              class: "gauntlet-summary-line",
              textContent:
                `${state.completed.length} completed · ${state.skipped.length} skipped · ` +
                `${VF.runState.formatDuration(elapsedMs(state))} elapsed`,
            }),
            VF.el("p", {
              class: "gauntlet-summary-line",
              textContent: `${minutes > 0 ? Math.round(state.score / minutes) : 0} points per minute`,
            }),
          ]),
        );
        return;
      }

      const entry = VF.runState.entryFor(state, state.queue[state.cursor]);
      const agent = state.agent ? VF.AGENTS_BY_TITLE.get(state.agent) : null;
      cardEl.append(
        VF.el("div", { class: "gauntlet-body" }, [
          VF.icons.render(entry, agent, "large"),
          VF.el("div", { class: "gauntlet-copy" }, [
            VF.el("span", {
              class: "gauntlet-index",
              textContent: `Challenge ${state.cursor + 1} of ${state.queue.length}`,
            }),
            VF.el("p", { class: "gauntlet-text", textContent: entry.text }),
            VF.runState.metaRow(entry),
          ]),
        ]),
      );
    }

    function renderHistory() {
      history.innerHTML = "";
      const rows = [
        ...state.completed.map((c) => ({ id: c.id, done: true, points: c.points })),
        ...state.skipped.map((id) => ({ id, done: false, points: 0 })),
      ];
      for (const row of rows.slice(-12).reverse()) {
        const entry = VF.runState.entryFor(state, row.id);
        history.appendChild(
          VF.el(
            "li",
            { class: row.done ? "history-row is-done" : "history-row is-skipped" },
            [
              VF.el("span", { class: "history-text", textContent: entry.text }),
              VF.el("span", {
                class: "history-points",
                textContent: row.done ? `+${row.points}` : "skipped",
              }),
            ],
          ),
        );
      }
    }

    function sync() {
      scoreEl.textContent = String(state.score);
      doneEl.textContent = String(state.completed.length);
      timerEl.textContent = VF.runState.formatDuration(elapsedMs(state));
      pauseBtn.textContent = state.pausedAt ? "Resume" : "Pause";
      completeBtn.disabled = state.finished || Boolean(state.pausedAt);
      skipBtn.disabled = state.finished || state.skipUsedOnCurrent || Boolean(state.pausedAt);
      skipBtn.textContent = state.skipUsedOnCurrent ? "Skip used" : "Skip";
      skipBtn.title = state.skipUsedOnCurrent
        ? "You already skipped — complete this one to get your skip back"
        : "One skip per draw. Skipped challenges score nothing.";
      renderCard();
      renderHistory();
    }

    root.append(header, cardEl, actions, history, api.footer(state));
    sync();

    // Only timestamps are stored, so the clock survives a refresh.
    const tick = setInterval(() => {
      if (!state.pausedAt && !state.finished) {
        timerEl.textContent = VF.runState.formatDuration(elapsedMs(state));
      }
    }, 500);
    api.onTeardown(() => clearInterval(tick));
  }

  VF.modes = VF.modes || {};
  VF.modes.gauntlet = {
    label: "Gauntlet",
    blurb: "One challenge at a time. One skip per draw. Most points in a match wins.",
    needs: () => 5,
    kind: "objective",
    build,
    render,
    score,
    completeCurrent,
    skipCurrent,
    elapsedMs,
  };
})(window.VF);
