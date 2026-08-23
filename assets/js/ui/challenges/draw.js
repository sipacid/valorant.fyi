// draw.js — pull a single challenge out of the roulette. Reuses the agent
// carousel wholesale; only the card faces differ.

(function (VF) {
  "use strict";

  function build({ seedStr, seed, pool, agent }) {
    if (!pool.length) return null;
    // The winner has to come from the seed, not from where the wheel happens to
    // stop, so it's chosen here and planted at CHOSEN_CARD_INDEX below.
    const winner = VF.runState.pickEntries(pool, 1, VF.seed.seedRng(seedStr, "draw:1"), seed)[0];
    return {
      v: VF.runState.STATE_VERSION,
      mode: "draw",
      seed: seedStr,
      shared: Boolean(seed.shared),
      agent: agent ?? null,
      challenge: winner.id,
      revealed: false,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  const score = (state) => VF.runState.entryFor(state, state.challenge).points;

  function render(root, state, api) {
    root.innerHTML = "";

    const entry = VF.runState.entryFor(state, state.challenge);
    const lockedAgent = state.agent ? VF.AGENTS_BY_TITLE.get(state.agent) : null;

    const panel = VF.el("div", { class: "draw-result" }, [
      VF.icons.render(entry, lockedAgent, "large"),
      VF.el("div", { class: "draw-copy" }, [
        VF.el("span", {
          class: "draw-kicker",
          textContent: entry.kind === "rule" ? "YOUR RULE" : "YOUR OBJECTIVE",
        }),
        VF.el("p", { class: "draw-text", textContent: entry.text }),
        VF.runState.metaRow(entry),
      ]),
    ]);

    const header = VF.el("div", { class: "run-header" }, [
      VF.el("div", { class: "run-title" }, [
        VF.el("h2", { textContent: "Single Draw" }),
        api.subtitle(state),
      ]),
    ]);

    root.append(header, panel, api.footer(state));

    if (!state.revealed) spin();

    function spin() {
      api.carousel(true);

      // Only the landed card is seeded — the 24 blurred cards flying past are
      // decoration, and it's better if they differ between players. The winner
      // goes through `winner` rather than into `items`, because spinCarousel
      // shuffles whatever it's given.
      const filler = api.pool().filter((e) => e.id !== entry.id);

      VF.spin.spinCarousel({
        items: filler.length ? filler : [entry],
        winner: entry,
        makeCard: (challenge, position) => {
          const rendered = {
            ...challenge,
            text: VF.catalog.renderChallengeText(challenge, lockedAgent),
          };
          return new VF.ChallengeCard(rendered, position, lockedAgent).createCard();
        },
        onLand() {
          state.revealed = true;
          api.save(state);
          VF.spin.showPostSpinButtons([
            { id: "spin-again", label: "Draw Again", onClick: () => api.reroll() },
            {
              id: "post-share-button",
              label: "Share",
              onClick: (event) => api.share(event.currentTarget),
            },
            {
              id: "post-agents-button",
              label: "Done",
              // Done means finished: go home, rather than dropping the player
              // back on the run screen to look at the result they just closed.
              onClick: () => api.exit(),
            },
          ]);
        },
      });
    }
  }

  VF.modes = VF.modes || {};
  VF.modes.draw = {
    label: "Single Draw",
    blurb: "Spin the wheel for one challenge. Quick, low commitment.",
    needs: () => 1,
    kind: "any",
    build,
    render,
    score,
  };
})(window.VF);
