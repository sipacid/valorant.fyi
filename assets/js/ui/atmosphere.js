// atmosphere.js — the decorative background: scrolling codename feed, scan bar,
// floating particles, and agent art preloading. All purely cosmetic.

(function (VF) {
  "use strict";

  function preloadAgentImages() {
    for (const { imgSrc } of VF.cardsData) {
      new Image().src = imgSrc;
    }
  }

  function createTacticalBackground() {
    const feed = VF.el("div", { class: "bg-feed", "aria-hidden": "true" });

    // Each item is ~75px tall (font + gap). The column needs at least one
    // viewport-height of items so the seamless -50% scroll loop never shows gaps.
    // Rounded up to a multiple of LCM(5, 7) = 35 so the nth-child color rules
    // match between the original half and the duplicated half — otherwise colors
    // shift at the loop boundary and read as a visual jump.
    const minItems = Math.max(35, Math.ceil(window.innerHeight / 50));
    const itemsPerColumn = Math.ceil(minItems / 35) * 35;
    const columnCount = 7;

    for (let c = 0; c < columnCount; c++) {
      // Alternate scroll direction per column for a busier, more chaotic feel.
      const goesDown = c % 2 === 1;
      const col = VF.el("div", {
        class: goesDown ? "feed-column feed-column--down" : "feed-column",
      });
      col.style.left = `${(c / (columnCount - 1)) * 92 + 4}%`;
      col.style.animationDuration = `${20 + Math.random() * 18}s`;
      col.style.animationDelay = `-${Math.random() * 25}s`;

      // Build the visible list of codenames, then duplicate it so the
      // translateY(-50%) loop is seamless.
      const names = [];
      for (let i = 0; i < itemsPerColumn; i++) {
        names.push(
          VF.cardsData[Math.floor(Math.random() * VF.cardsData.length)].title.toUpperCase(),
        );
      }
      for (const name of names.concat(names)) {
        col.appendChild(VF.el("span", { textContent: name }));
      }

      feed.appendChild(col);
    }

    document.body.appendChild(feed);
    document.body.appendChild(VF.el("div", { class: "scan-bar", "aria-hidden": "true" }));
  }

  function createParticles() {
    const count = 18;
    for (let i = 0; i < count; i++) {
      const particle = VF.el("div", { class: "particle" });
      const size = `${1 + Math.random() * 2}px`;
      particle.style.left = `${Math.random() * 100}vw`;
      particle.style.animationDuration = `${15 + Math.random() * 15}s`;
      particle.style.animationDelay = `${Math.random() * 10}s`;
      particle.style.width = size;
      particle.style.height = size;
      document.body.appendChild(particle);
    }
  }

  VF.atmosphere = { preloadAgentImages, createTacticalBackground, createParticles };
})(window.VF);
