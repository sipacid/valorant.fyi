// agentPool.js — the "Agent Pool" overlay: which agents the spinner may land on.

(function (VF) {
  "use strict";

  const STORAGE_KEY = "included-agents";

  const selectionOverlay = VF.qs("#selection-overlay");
  const selectionGrid = VF.qs("#selection-grid");
  const selectionAll = VF.qs("#selection-all");
  const selectionNone = VF.qs("#selection-none");
  const selectionDone = VF.qs("#selection-done");
  const selectionCount = VF.qs("#selection-count");

  let included = load();
  let gridBuilt = false;
  const listeners = new Set();

  function load() {
    const fallback = VF.cardsData.map((card) => card.title);
    const stored = VF.store.read(STORAGE_KEY, fallback);
    return new Set(Array.isArray(stored) ? stored : fallback);
  }

  function save() {
    VF.store.write(STORAGE_KEY, [...included]);
    for (const fn of listeners) fn(included);
    syncCount();
  }

  function syncCount() {
    if (selectionCount) {
      const n = included.size;
      selectionCount.textContent = `${n} of ${VF.cardsData.length} in the pool`;
      selectionCount.classList.toggle("is-empty", n === 0);
    }
  }

  function buildSelectionGrid() {
    if (!selectionGrid || gridBuilt) return;
    gridBuilt = true;
    selectionGrid.innerHTML = "";

    for (const data of VF.cardsData) {
      const card = new VF.Card(data.title, data.imgSrc, data.imgAlt, 0);
      const wrap = card.createCard();
      wrap.classList.add("selection-card");
      wrap.tabIndex = 0;
      wrap.setAttribute("role", "button");
      if (!included.has(data.title)) wrap.classList.add("is-out");
      syncPressed(wrap, data.title);

      const back = wrap.querySelector(".card-back");
      if (back) {
        back.appendChild(
          VF.el("img", { src: data.imgSrc, alt: "", className: "card-back-img" }),
        );
      }

      wrap.appendChild(
        VF.el("span", { class: "selection-card-label", textContent: data.title }),
      );

      const toggle = () => {
        if (included.has(data.title)) {
          included.delete(data.title);
          wrap.classList.add("is-out");
        } else {
          included.add(data.title);
          wrap.classList.remove("is-out");
        }
        syncPressed(wrap, data.title);
        save();
      };

      wrap.addEventListener("click", toggle);
      wrap.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggle();
        }
      });

      selectionGrid.appendChild(wrap);
    }
  }

  function syncPressed(wrap, title) {
    wrap.setAttribute("aria-pressed", String(included.has(title)));
    wrap.setAttribute(
      "aria-label",
      `${title} — ${included.has(title) ? "in the pool" : "excluded"}`,
    );
  }

  function setAllSelection(includeAll) {
    included = new Set(includeAll ? VF.cardsData.map((c) => c.title) : []);
    save();
    if (!selectionGrid) return;
    for (const wrap of selectionGrid.querySelectorAll(".selection-card")) {
      wrap.classList.toggle("is-out", !includeAll);
      const title = wrap.querySelector(".selection-card-label")?.textContent;
      if (title) syncPressed(wrap, title);
    }
  }

  const overlay = VF.makeOverlay(selectionOverlay, {
    onOpen() {
      buildSelectionGrid();
      syncCount();
    },
  });

  if (selectionDone) selectionDone.addEventListener("click", overlay.close);
  if (selectionAll) selectionAll.addEventListener("click", () => setAllSelection(true));
  if (selectionNone) selectionNone.addEventListener("click", () => setAllSelection(false));

  VF.agentPool = {
    open: overlay.open,
    close: overlay.close,
    getIncluded: () => new Set(included),
    /** The agents the spinner may land on. Empty means the user excluded everything. */
    getPool: () => VF.cardsData.filter((c) => included.has(c.title)),
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
})(window.VF);
