// spin.js — the 3D roulette carousel, shared by the agent spin and the
// single-challenge draw.

(function (VF) {
  "use strict";

  const TOTAL_CARDS = 25;
  const CHOSEN_CARD_INDEX = 1; // The card that will be chosen (0-indexed)
  const ANIMATION_DURATION = 3000; // must match .slider animation-duration in CSS

  const sliderElement = VF.qs(".slider");
  const mainElement = VF.qs("main");
  const landingButtons = VF.qs(".landing-buttons");
  const startButton = VF.qs("#start");
  const poolWarning = VF.qs("#pool-warning");

  /** The agent the last spin landed on — seeds the challenge screen's agent lock. */
  let lastAgent = null;

  function resetSliderAnimation() {
    sliderElement.innerHTML = "";
    sliderElement.classList.remove("spin-complete");
    document.body.classList.remove("spin-active");
    const parent = sliderElement.parentNode;
    sliderElement.remove();
    parent.appendChild(sliderElement);
  }

  function clearPostSpinButtons() {
    const existing = VF.qs("#post-spin-buttons");
    if (existing) existing.remove();
  }

  /**
   * Runs the carousel over an arbitrary list of items.
   *
   * The winner is always the card at CHOSEN_CARD_INDEX — the wheel always stops
   * at 0deg, so randomness lives entirely in which item ends up at that index.
   *
   * Pass `winner` when the result must come from somewhere other than this
   * function's own shuffle (the seeded challenge draw). Placing it in `items`
   * yourself does not work: the shuffle below would move it.
   *
   * @param {{items: any[], winner?: any,
   *          makeCard: (item: any, position: number) => HTMLElement,
   *          onLand: (item: any, cardElement: HTMLElement) => void}} options
   */
  function spinCarousel({ items, winner, makeCard, onLand }) {
    if (!sliderElement || !items.length) return;
    resetSliderAnimation();

    let gameCards = VF.rng.shuffleArray(items);
    while (gameCards.length < TOTAL_CARDS) {
      gameCards.push(items[Math.floor(Math.random() * items.length)]);
    }
    gameCards = gameCards.slice(0, TOTAL_CARDS);
    if (winner !== undefined) gameCards[CHOSEN_CARD_INDEX] = winner;

    let index = 0;
    for (const data of gameCards) {
      sliderElement.appendChild(makeCard(data, index++));
    }

    sliderElement.style.setProperty("--quantity", gameCards.length);

    // Mark the chosen wrap upfront so its sibling-fade animation can exclude it.
    const wraps = sliderElement.querySelectorAll(".card-wrap");
    if (wraps[CHOSEN_CARD_INDEX]) wraps[CHOSEN_CARD_INDEX].classList.add("chosen-wrap");

    // Randomize total spin: 5-7 full rotations, always ending at 0deg
    // (chosen card faces camera). Decorative, so intentionally unseeded.
    const rotations = 5 + Math.floor(Math.random() * 3);
    sliderElement.style.setProperty("--total-spin", `${-360 * rotations}deg`);

    VF.audio.scheduleSpinSound(ANIMATION_DURATION);

    setTimeout(() => {
      const cards = sliderElement.querySelectorAll(".card");
      const chosenCard = cards[CHOSEN_CARD_INDEX];
      if (!chosenCard) return;

      chosenCard.classList.add("chosen-card");
      requestAnimationFrame(() => chosenCard.classList.add("card-reveal"));

      sliderElement.classList.add("spin-complete");
      document.body.classList.add("spin-active");
      mainElement.classList.add("shake");
      setTimeout(() => mainElement.classList.remove("shake"), 320);

      onLand(gameCards[CHOSEN_CARD_INDEX], chosenCard);
    }, ANIMATION_DURATION);
  }

  /** Row of buttons shown under the landed card. */
  function showPostSpinButtons(buttons) {
    clearPostSpinButtons();
    const row = VF.el(
      "div",
      { id: "post-spin-buttons" },
      buttons.map(({ id, label, onClick }) =>
        VF.el("button", { id, type: "button", textContent: label, onClick }),
      ),
    );
    sliderElement.parentNode.appendChild(row);
    return row;
  }

  /**
   * The agent roulette. Always unseeded and always local: a team can't run
   * duplicate agents, so sharing an agent roll would be actively wrong.
   */
  function start() {
    const pool = VF.agentPool.getPool();
    if (!pool.length) {
      showPoolWarning(true);
      VF.agentPool.open();
      return;
    }
    showPoolWarning(false);

    if (landingButtons) landingButtons.style.display = "none";
    clearPostSpinButtons();

    spinCarousel({
      items: pool,
      makeCard: (data, position) =>
        new VF.Card(data.title, data.imgSrc, data.imgAlt, position).createCard(),
      onLand(data, cardElement) {
        lastAgent = data.title;
        cardElement.addEventListener("click", reset);
        showPostSpinButtons([
          { id: "spin-again", label: "Spin Again", onClick: reset },
          {
            id: "post-challenge-start",
            label: VF.challenges.quickStartLabel(),
            onClick: () => VF.challenges.quickStart(lastAgent),
          },
          {
            id: "post-challenges-button",
            label: "Options",
            onClick: () => VF.challenges.open({ agent: lastAgent }),
          },
          { id: "post-agents-button", label: "Agents", onClick: VF.agentPool.open },
        ]);
      },
    });
  }

  function reset() {
    clearPostSpinButtons();
    resetSliderAnimation();
    start();
  }

  /** Returns the carousel and the landing buttons to their initial state. */
  function backToLanding() {
    clearPostSpinButtons();
    resetSliderAnimation();
    if (landingButtons) landingButtons.style.display = "";
  }

  function showPoolWarning(show) {
    if (poolWarning) poolWarning.hidden = !show;
  }

  function syncStartAvailability(included) {
    const empty = included.size === 0;
    if (startButton) startButton.disabled = empty;
    showPoolWarning(empty);
  }

  VF.spin = {
    TOTAL_CARDS,
    CHOSEN_CARD_INDEX,
    ANIMATION_DURATION,
    spinCarousel,
    showPostSpinButtons,
    clearPostSpinButtons,
    resetSliderAnimation,
    backToLanding,
    start,
    reset,
    syncStartAvailability,
    getLastAgent: () => lastAgent,
    setLastAgent: (title) => {
      lastAgent = title;
    },
  };
})(window.VF);
