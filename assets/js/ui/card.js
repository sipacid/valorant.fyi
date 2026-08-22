// card.js — the 3D carousel card, and its challenge-flavoured subclass.

(function (VF) {
  "use strict";

  const BACKGROUND_COUNT = 5;

  // Purely decorative, so it stays on Math.random() even inside seeded runs —
  // two players on the same seed should see the same challenges but their own art.
  const getRandomBackground = () =>
    `./assets/img/card-backgrounds/card-background-${
      Math.floor(Math.random() * BACKGROUND_COUNT) + 1
    }.svg`;

  class Card {
    constructor(title, imgSrc, imgAlt, position) {
      this.title = title;
      this.imgSrc = imgSrc;
      this.imgAlt = imgAlt;
      this.background = getRandomBackground();
      this.xRotation = Math.random() * 1.2;
      this.yRotation = Math.random() * 1.2;
      this.position = position;
    }

    /** Subclasses override this to fill the front face. */
    createContent() {
      const cardContent = document.createElement("div");
      cardContent.className = "card-content";

      const header = document.createElement("header");
      const h1 = document.createElement("h1");
      h1.textContent = this.title;

      const img = document.createElement("img");
      img.src = this.imgSrc;
      img.alt = this.imgAlt;

      header.appendChild(h1);
      cardContent.appendChild(header);
      cardContent.appendChild(img);
      return cardContent;
    }

    createCard() {
      const cardWrap = document.createElement("div");
      cardWrap.className = "card-wrap";
      cardWrap.style.setProperty("--random-rotation-x", this.xRotation);
      cardWrap.style.setProperty("--random-rotation-y", this.yRotation);
      cardWrap.style.setProperty("--position", this.position);

      const card = document.createElement("article");
      card.className = "card";

      const cardFront = document.createElement("div");
      cardFront.className = "card-front";
      cardFront.style.backgroundImage = `url(${this.background})`;
      cardFront.appendChild(this.createContent());

      const cardBack = document.createElement("div");
      cardBack.className = "card-back";

      // .card-inner is the flip pivot — rotates around Y independently of the
      // carousel orbit so back faces become visible on front-of-orbit cards too.
      const cardInner = document.createElement("div");
      cardInner.className = "card-inner";
      cardInner.appendChild(cardFront);
      cardInner.appendChild(cardBack);
      card.appendChild(cardInner);
      cardWrap.appendChild(card);

      return cardWrap;
    }
  }

  /**
   * A carousel card showing a challenge instead of an agent portrait. Keeps the
   * exact .card-wrap > .card > .card-inner > .card-front structure so every
   * existing rule (.chosen-card, .card-reveal, spin-blur) applies unchanged.
   */
  class ChallengeCard extends Card {
    /**
     * @param {{text: string, kind: string, difficulty: number, points: number,
     *          scope: string}} challenge already slot-rendered for the player's agent
     * @param {number} position
     * @param {Object|null} agent locked agent, so the icon can resolve to an ability
     */
    constructor(challenge, position, agent) {
      super(challenge.kind === "rule" ? "Rule" : "Objective", null, "", position);
      this.challenge = challenge;
      this.agent = agent || null;
    }

    createCard() {
      const wrap = super.createCard();
      // Lets the stylesheet give challenge cards their own proportions — the
      // 9:16 frame is sized for full-body agent art and looks empty holding one
      // sentence.
      wrap.querySelector(".card").classList.add("card--challenge");
      return wrap;
    }

    createContent() {
      const c = this.challenge;
      const cardContent = VF.el("div", { class: "card-content card-content--challenge" }, [
        VF.el("header", {}, [
          VF.el("h1", { textContent: this.title }),
          VF.el("span", { class: "challenge-scope", textContent: c.scope === "round" ? "ONE ROUND" : "WHOLE MATCH" }),
        ]),
        VF.icons.render(c, this.agent, "large"),
        VF.el("p", { class: "challenge-text", textContent: c.text }),
        VF.el("div", { class: "challenge-meta" }, [
          VF.el("span", {
            class: `difficulty-pip difficulty-pip--${c.difficulty}`,
            title: `Difficulty ${c.difficulty}`,
            "aria-label": `Difficulty ${c.difficulty} of 4`,
          }),
          VF.el("span", { class: "challenge-points", textContent: `${c.points} pts` }),
        ]),
      ]);
      return cardContent;
    }
  }

  VF.Card = Card;
  VF.ChallengeCard = ChallengeCard;
  VF.getRandomBackground = getRandomBackground;
})(window.VF);
