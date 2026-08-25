// index.js — the challenge screen: mode picker, run lifecycle, shared-link handling.

(function (VF) {
  "use strict";

  const screenEl = VF.qs("#challenge-screen");
  const pickerEl = VF.qs("#mode-picker");
  const runRootEl = VF.qs("#run-root");
  const bannerEl = VF.qs("#challenge-banner");
  const flashEl = VF.qs("#challenge-flash");

  let prefs = VF.runState.loadPrefs();
  let lockedAgent = null;
  let teardowns = [];

  const modeOrder = ["bingo", "gauntlet", "ruleset", "draw"];
  const modeOf = (name) => VF.modes[name];

  // ------------------------------------------------------------------
  // Pool assembly
  // ------------------------------------------------------------------

  /**
   * A run is either *shareable* (official catalog only, so everyone on the link
   * builds the identical card) or *local* (your disabled list and your custom
   * challenges apply, but the card can't be shared). You can't have both.
   */
  function poolFor({ seedObj, local, agentMode, diffMask, opts, agent }) {
    if (!local) return VF.pool.resolve({ seed: seedObj }).pool;
    const { pool } = VF.pool.resolve({ seed: null, agentMode, diffMask, opts });
    return agentMode === 1 ? VF.pool.forAgent(pool, agent) : pool;
  }

  function availability(modeName) {
    const mode = modeOf(modeName);
    const seedStr = VF.seed.newSeed({
      mode: modeName,
      agentMode: prefs.agentMode,
      diffMask: prefs.diffMask,
      tier: prefs.tier,
      opts: prefs.opts,
    });
    const seedObj = VF.seed.decodeSeed(seedStr);
    const pool = poolFor({
      seedObj,
      local: prefs.local,
      agentMode: prefs.agentMode,
      diffMask: prefs.diffMask,
      opts: prefs.opts,
      agent: lockedAgent,
    });
    const usable =
      mode.kind === "any" ? pool : pool.filter((e) => e.kind === mode.kind);
    return { have: usable.length, need: mode.needs(seedObj) };
  }

  // ------------------------------------------------------------------
  // Run lifecycle
  // ------------------------------------------------------------------

  function buildRun(modeName) {
    const mode = modeOf(modeName);
    const seedStr = VF.seed.newSeed({
      mode: modeName,
      agentMode: prefs.agentMode,
      diffMask: prefs.diffMask,
      tier: prefs.tier,
      opts: prefs.opts,
    });
    const seedObj = VF.seed.decodeSeed(seedStr);
    const pool = poolFor({
      seedObj,
      local: prefs.local,
      agentMode: prefs.agentMode,
      diffMask: prefs.diffMask,
      opts: prefs.opts,
      agent: lockedAgent,
    });
    const state = mode.build({
      seedStr,
      seed: { ...seedObj, shared: !prefs.local },
      pool,
      agent: prefs.agentMode === 1 ? lockedAgent : null,
    });
    if (!state) return null;
    state.local = Boolean(prefs.local);
    return VF.runState.saveRun(state);
  }

  /** Rebuilds a saved run's card from its seed — nothing about the card is stored. */
  function rehydrate(state) {
    const seedObj = VF.seed.decodeSeed(state.seed);
    if (!seedObj) return null;
    const compat = VF.seed.compatibility(seedObj);
    if (!compat.ok) return null;
    return seedObj;
  }

  function startRun(modeName) {
    const state = buildRun(modeName);
    if (!state) return;
    VF.router.setSeedParam(state.local ? null : state.seed);
    VF.router.go("run");
  }

  /** "I'm finished" — used by the run footer's Exit and by draw mode's Done. */
  function exitRun() {
    VF.runState.clearRun();
    VF.router.setSeedParam(null);
    VF.router.go("landing");
  }

  function teardown() {
    for (const fn of teardowns) fn();
    teardowns = [];
    VF.spin.clearPostSpinButtons();
    document.body.classList.remove("carousel-takeover");
  }

  // ------------------------------------------------------------------
  // Shared run API handed to each mode
  // ------------------------------------------------------------------

  function makeApi(state) {
    return {
      save: (s) => VF.runState.saveRun(s),
      pool() {
        const seedObj = VF.seed.decodeSeed(state.seed);
        return poolFor({
          seedObj,
          local: state.local,
          agentMode: seedObj.agentMode,
          diffMask: seedObj.diffMask,
          opts: seedObj.opts,
          agent: state.agent,
        });
      },
      subtitle(s) {
        const bits = [];
        if (s.agent) bits.push(`Locked to ${s.agent}`);
        else bits.push("Any agent");
        bits.push(s.local ? "Your custom pool" : "Official pool");
        return VF.el("p", { class: "run-subtitle", textContent: bits.join(" · ") });
      },
      footer(s) {
        return VF.el("div", { class: "run-footer" }, [
          VF.el("button", {
            type: "button",
            class: "run-action",
            textContent: "New card",
            onClick: () => startRun(s.mode),
          }),
          VF.el("button", {
            type: "button",
            class: "run-action",
            textContent: "Change mode",
            onClick() {
              VF.runState.clearRun();
              VF.router.setSeedParam(null);
              VF.router.go("modes");
            },
          }),
          VF.el("button", {
            type: "button",
            class: "run-action run-action--primary",
            textContent: s.local ? "Can't share" : "Copy share link",
            disabled: s.local,
            title: s.local
              ? "Cards using your custom pool can't be shared — others don't have your challenges."
              : "Everyone gets the same challenges. Everyone rolls their own agent.",
            onClick: (event) => shareCurrent(s, event.currentTarget),
          }),
          VF.el("button", {
            type: "button",
            class: "run-action",
            textContent: "Challenge pool",
            onClick: VF.manage.open,
          }),
          VF.el("button", {
            type: "button",
            class: "run-action",
            textContent: "Exit",
            onClick: exitRun,
          }),
        ]);
      },
      shake() {
        const main = VF.qs("main");
        if (!main) return;
        main.classList.add("shake");
        setTimeout(() => main.classList.remove("shake"), 320);
      },
      flash(text) {
        if (!flashEl) return;
        flashEl.textContent = text;
        flashEl.classList.remove("is-on");
        // Force a reflow so the animation restarts on a repeat win.
        void flashEl.offsetWidth;
        flashEl.classList.add("is-on");
        setTimeout(() => flashEl.classList.remove("is-on"), 1200);
      },
      carousel(on) {
        document.body.classList.toggle("carousel-takeover", Boolean(on));
        if (!on) VF.spin.clearPostSpinButtons();
      },
      reroll: () => startRun(state.mode),
      share: (button) => shareCurrent(state, button),
      exit: exitRun,
      onTeardown: (fn) => teardowns.push(fn),
    };
  }

  /**
   * Feedback goes to a document-level toast rather than the in-screen banner:
   * the banner lives inside #challenge-screen, which is hidden while the
   * carousel is taken over — exactly when draw mode's Share button is pressed.
   *
   * @param {HTMLElement} [button] the button pressed, for an inline "Copied!"
   */
  async function shareCurrent(state, button) {
    if (state.local) {
      VF.toast("This card uses your own challenges, so it can't be shared.", "warn");
      return;
    }
    const result = await VF.share.copy(state.seed);
    if (result.ok) {
      VF.toast("Link copied — everyone gets the same challenges.", "ok");
      VF.confirmButton(button, "Copied!");
    } else {
      VF.toast("Couldn't copy automatically — copy the link from the box.", "warn");
    }
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------

  function showBanner(text, tone) {
    if (!bannerEl) return;
    bannerEl.textContent = text;
    bannerEl.className = `challenge-banner challenge-banner--${tone || "info"}`;
    bannerEl.hidden = false;
  }

  const hideBanner = () => {
    if (bannerEl) bannerEl.hidden = true;
  };

  function renderPicker() {
    if (!pickerEl) return;
    // Re-read rather than trusting the module-level copy: the challenge-pool
    // overlay writes prefs too (it switches the custom pool on when you add your
    // first challenge), and a stale copy here made the toggle look untouched.
    // Every mutation persists immediately, so loading is always current.
    prefs = VF.runState.loadPrefs();
    pickerEl.innerHTML = "";

    const modeCards = VF.el(
      "div",
      { class: "mode-cards", role: "radiogroup", "aria-label": "Challenge mode" },
      modeOrder.map((name) => {
        const mode = modeOf(name);
        const { have, need } = availability(name);
        const ok = have >= need;
        const card = VF.el(
          "button",
          {
            type: "button",
            class: `mode-card${prefs.mode === name ? " is-selected" : ""}${ok ? "" : " is-short"}`,
            role: "radio",
            "aria-checked": String(prefs.mode === name),
            onClick() {
              prefs.mode = name;
              VF.runState.savePrefs(prefs);
              renderPicker();
            },
          },
          [
            VF.el("h3", { textContent: mode.label }),
            VF.el("p", { class: "mode-blurb", textContent: mode.blurb }),
            VF.el("span", {
              class: "mode-availability",
              textContent: ok
                ? `${have} challenges available`
                : `Needs ${need}, only ${have} available`,
            }),
          ],
        );
        return card;
      }),
    );

    const agentRow = VF.el("div", { class: "picker-row" }, [
      VF.el("span", { class: "picker-label", textContent: "Agent" }),
      VF.el("div", { class: "picker-controls" }, [
        toggle("Any agent", prefs.agentMode === 0, () => {
          prefs.agentMode = 0;
          VF.runState.savePrefs(prefs);
          renderPicker();
        }),
        toggle("Lock to my agent", prefs.agentMode === 1, () => {
          prefs.agentMode = 1;
          VF.runState.savePrefs(prefs);
          renderPicker();
        }),
        prefs.agentMode === 1 ? agentSelect() : null,
      ]),
    ]);

    // The tier decides the *mix*; the star row below decides what's *eligible*.
    // They're independent — Hard with only 1-2★ allowed just means as many 2★ as
    // the pool can give.
    const tierRow = VF.el("div", { class: "picker-row" }, [
      VF.el("span", { class: "picker-label", textContent: "Mix" }),
      VF.el(
        "div",
        { class: "picker-controls" },
        VF.runState.TIERS.map((tier, index) =>
          toggle(
            tier.label,
            prefs.tier === index,
            () => {
              prefs.tier = index;
              VF.runState.savePrefs(prefs);
              renderPicker();
            },
            `tier-toggle tier-toggle--${tier.id}`,
          ),
        ),
      ),
    ]);

    const diffRow = VF.el("div", { class: "picker-row" }, [
      VF.el("span", { class: "picker-label", textContent: "Allowed" }),
      VF.el(
        "div",
        { class: "picker-controls" },
        [1, 2, 3, 4].map((d) =>
          toggle(
            "★".repeat(d),
            Boolean(prefs.diffMask & (1 << (d - 1))),
            () => {
              const next = prefs.diffMask ^ (1 << (d - 1));
              if (!next) return; // never let every difficulty be switched off
              prefs.diffMask = next;
              VF.runState.savePrefs(prefs);
              renderPicker();
            },
            `difficulty-toggle difficulty-toggle--${d}`,
          ),
        ),
      ),
    ]);

    const optRow = VF.el("div", { class: "picker-row" }, [
      VF.el("span", { class: "picker-label", textContent: "Options" }),
      VF.el("div", { class: "picker-controls" }, [
        toggle("Free centre square", Boolean(prefs.opts & VF.seed.OPT_FREE_CENTER), () => {
          prefs.opts ^= VF.seed.OPT_FREE_CENTER;
          VF.runState.savePrefs(prefs);
          renderPicker();
        }),
        toggle("No meme challenges", Boolean(prefs.opts & VF.seed.OPT_NO_MEME), () => {
          prefs.opts ^= VF.seed.OPT_NO_MEME;
          VF.runState.savePrefs(prefs);
          renderPicker();
        }),
        toggle("Include my own challenges", Boolean(prefs.local), () => {
          prefs.local = !prefs.local;
          VF.runState.savePrefs(prefs);
          renderPicker();
        }),
      ]),
    ]);

    const { have, need } = availability(prefs.mode);
    const needsAgent = prefs.agentMode === 1 && !lockedAgent;
    const blocked = needsAgent || have < need;

    const startBtn = VF.el("button", {
      type: "button",
      id: "challenge-start",
      textContent: `Start ${modeOf(prefs.mode).label}`,
      disabled: blocked,
      onClick: () => startRun(prefs.mode),
    });

    const blockedReason = blocked
      ? VF.el("span", {
          class: "picker-blocked",
          role: "status",
          textContent: needsAgent
            ? "Pick an agent above, or switch to Any agent."
            : `Only ${have} challenges available — this mode needs ${need}.`,
        })
      : null;

    pickerEl.append(
      VF.el("header", { class: "picker-header" }, [
        VF.el("h2", { textContent: "Challenges" }),
        VF.el("p", {
          class: "picker-subtitle",
          textContent: prefs.local
            ? "Using your own pool — this card can't be shared."
            : "Official pool. Share the link and everyone gets the same card.",
        }),
      ]),
      modeCards,
      VF.el("div", { class: "picker-rows" }, [agentRow, tierRow, diffRow, optRow]),
      VF.el("div", { class: "picker-actions" }, [
        startBtn,
        blockedReason,
        VF.el("button", {
          type: "button",
          class: "run-action",
          textContent: "Challenge pool",
          onClick: VF.manage.open,
        }),
        VF.el("button", {
          type: "button",
          class: "run-action",
          textContent: "Back",
          onClick: () => VF.router.go("landing"),
        }),
      ]),
    );
  }

  function toggle(label, active, onClick, extraClass) {
    return VF.el("button", {
      type: "button",
      class: `picker-toggle${active ? " is-active" : ""}${extraClass ? ` ${extraClass}` : ""}`,
      "aria-pressed": String(active),
      textContent: label,
      onClick,
    });
  }

  function agentSelect() {
    const select = VF.el("select", {
      class: "picker-select",
      "aria-label": "Which agent to lock challenges to",
      onChange() {
        lockedAgent = select.value || null;
        renderPicker();
      },
    });
    select.appendChild(VF.el("option", { value: "", textContent: "Pick an agent…" }));
    for (const agent of VF.cardsData) {
      select.appendChild(VF.el("option", { value: agent.title, textContent: agent.title }));
    }
    select.value = lockedAgent ?? "";
    return select;
  }

  function renderRun() {
    if (!runRootEl) return;
    teardown();

    const state = VF.runState.loadRun();
    if (!state) {
      VF.router.go("modes");
      return;
    }
    if (!rehydrate(state)) {
      showBanner("That card was made with a newer challenge list. Refresh the page.", "warn");
      VF.router.go("modes");
      return;
    }

    const mode = modeOf(state.mode);
    // Lets the stylesheet size the container per mode — bingo wants to match its
    // square grid, the others want the full width.
    runRootEl.dataset.mode = state.mode;
    mode.render(runRootEl, state, makeApi(state));
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------

  /** Opens the challenge screen, optionally carrying over the agent just spun. */
  function open({ agent } = {}) {
    // Reload before writing. The challenge-pool overlay also persists prefs (it
    // switches the custom pool on when you add your first challenge), so saving
    // the stale module copy here quietly reverted that.
    prefs = VF.runState.loadPrefs();
    if (agent) lockedAgent = agent;
    if (agent && prefs.agentMode === 0) {
      // Coming straight off a spin, locking to that agent is the obvious intent.
      prefs.agentMode = 1;
      VF.runState.savePrefs(prefs);
    }
    VF.router.go("modes");
  }

  /**
   * Straight from the spin result into a run, using the saved mode and settings.
   * Going spin -> picker -> start made rolling an agent and then playing a
   * challenge with it feel like two unrelated features.
   */
  function quickStart(agent) {
    prefs = VF.runState.loadPrefs();
    if (agent) {
      lockedAgent = agent;
      prefs.agentMode = 1;
      VF.runState.savePrefs(prefs);
    }
    const { have, need } = availability(prefs.mode);
    if (have < need) {
      // Not enough challenges for the saved mode — let them sort it out in the
      // picker rather than failing silently.
      open({ agent });
      return;
    }
    startRun(prefs.mode);
  }

  /** Label for the post-spin button, e.g. "Start Bingo". */
  const quickStartLabel = () => `Start ${modeOf(VF.runState.loadPrefs().mode).label}`;

  /**
   * A `?c=` link means someone else built this card. Rebuild it from their seed
   * rather than whatever this browser had saved.
   */
  function adoptSharedSeed() {
    const seedStr = VF.router.seedParam();
    if (!seedStr) return false;

    const seedObj = VF.seed.decodeSeed(seedStr);
    if (!seedObj) {
      showBanner("That share link isn't valid.", "warn");
      VF.router.setSeedParam(null);
      return false;
    }

    const compat = VF.seed.compatibility(seedObj);
    if (!compat.ok) {
      showBanner(
        "This card was made with a newer challenge list — refresh the page to catch up.",
        "warn",
      );
      return false;
    }

    const existing = VF.runState.loadRun();
    if (existing && existing.seed === seedStr) {
      // Same card, already in progress — keep the marks.
      showSharedBanner();
      return true;
    }

    const mode = modeOf(seedObj.modeName);
    const pool = poolFor({ seedObj, local: false });
    const state = mode.build({
      seedStr,
      seed: { ...seedObj, shared: true },
      pool,
      agent: seedObj.agentMode === 1 ? lockedAgent : null,
    });
    if (!state) {
      showBanner("That card can't be built from the current challenge list.", "warn");
      return false;
    }
    state.local = false;
    VF.runState.saveRun(state);
    showSharedBanner();
    return true;
  }

  function showSharedBanner() {
    showBanner(
      "Shared card — official challenge list. Your local filters are ignored so everyone sees the same thing.",
      "info",
    );
  }

  function init() {
    prefs = VF.runState.loadPrefs();
    lockedAgent = VF.spin.getLastAgent();

    const adopted = adoptSharedSeed();

    VF.router.onRoute((screen) => {
      if (screen === "modes") {
        hideBannerIfLocal();
        renderPicker();
        teardown();
      } else if (screen === "run") {
        renderRun();
      } else {
        teardown();
        hideBanner();
        VF.spin.backToLanding();
      }
    });

    VF.router.init();

    if (adopted && VF.router.current() !== "run") VF.router.go("run");
  }

  function hideBannerIfLocal() {
    if (!VF.router.seedParam()) hideBanner();
  }

  VF.challenges = { open, init, renderPicker, startRun, quickStart, quickStartLabel };
})(window.VF);
