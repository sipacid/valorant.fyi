// ruleset.js — a "contract" of 2-4 match-long rules you agree to before queueing.

(function (VF) {
  "use strict";

  const MIN_RULES = 2;
  const MAX_RULES = 4;

  /**
   * Takes at most one rule per conflict group, so you never get handed
   * "Bucky only" and "Sidearms only" in the same contract.
   */
  function dedupeConflicts(rules, limit) {
    const groups = new Set();
    const picked = [];
    for (const rule of rules) {
      if (picked.length >= limit) break;
      if (rule.conflictGroup) {
        if (groups.has(rule.conflictGroup)) continue;
        groups.add(rule.conflictGroup);
      }
      picked.push(rule);
    }
    return picked;
  }

  function build({ seedStr, seed, pool, agent }) {
    const rules = pool.filter((e) => e.kind === "rule");
    if (rules.length < MIN_RULES) return null;

    const rng = VF.seed.seedRng(seedStr, "ruleset");
    const count = MIN_RULES + VF.rng.randInt(rng, MAX_RULES - MIN_RULES + 1);
    // Ordered by the tier's mix, then deduped — so a Very Hard contract reaches
    // for the punishing rules first.
    const picked = dedupeConflicts(VF.runState.pickEntries(rules, rules.length, rng, seed), count);
    if (picked.length < MIN_RULES) return null;

    return {
      v: VF.runState.STATE_VERSION,
      mode: "ruleset",
      seed: seedStr,
      shared: Boolean(seed.shared),
      agent: agent ?? null,
      rules: picked.map((e) => e.id),
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  const score = (state) =>
    state.rules.reduce((sum, id) => sum + VF.runState.entryFor(state, id).points, 0);

  function render(root, state, api) {
    root.innerHTML = "";

    const header = VF.el("div", { class: "run-header" }, [
      VF.el("div", { class: "run-title" }, [
        VF.el("h2", { textContent: "The Contract" }),
        api.subtitle(state),
      ]),
      VF.el("div", { class: "run-stats" }, [
        VF.el("div", { class: "run-stat run-stat--score" }, [
          VF.el("span", { class: "run-stat-label", textContent: "Handicap" }),
          VF.el("span", { class: "run-score-value", textContent: String(score(state)) }),
        ]),
      ]),
    ]);

    const agent = state.agent ? VF.AGENTS_BY_TITLE.get(state.agent) : null;

    const stack = VF.el(
      "div",
      { class: "ruleset-stack" },
      state.rules.map((id, i) => {
        const entry = VF.runState.entryFor(state, id);
        const card = VF.el("article", { class: "ruleset-card" }, [
          VF.el("div", { class: "ruleset-head" }, [
            VF.icons.render(entry, agent, "inline"),
            VF.el("span", { class: "ruleset-index", textContent: `RULE ${i + 1}` }),
          ]),
          VF.el("p", { class: "ruleset-text", textContent: entry.text }),
          VF.runState.metaRow(entry),
        ]);
        // Decorative fan, so unseeded on purpose.
        card.style.setProperty("--fan", `${(Math.random() - 0.5) * 2.4}deg`);
        return card;
      }),
    );

    root.append(
      header,
      VF.el("p", {
        class: "ruleset-preamble",
        textContent: "Agree to all of these for the whole match. No takebacks.",
      }),
      stack,
      api.footer(state),
    );
  }

  VF.modes = VF.modes || {};
  VF.modes.ruleset = {
    label: "Contract",
    blurb: "2-4 match-long rules you have to play under. Handicap yourself.",
    needs: () => MIN_RULES,
    kind: "rule",
    build,
    render,
    score,
    dedupeConflicts,
  };
})(window.VF);
