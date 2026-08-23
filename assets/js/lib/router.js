// router.js — the site has four "screens" and no framework, so navigation is a
// hash fragment reflected onto <body data-screen>, with CSS doing the showing
// and hiding. Same idiom as the existing body.spin-active class.
//
// The seed lives in the *query* string (`?c=`), not the hash, precisely so that
// changing screens doesn't drop it.

(function (VF) {
  "use strict";

  const SCREENS = ["landing", "modes", "run"];
  const listeners = new Set();

  function current() {
    const raw = location.hash.replace(/^#\/?/, "");
    return SCREENS.includes(raw) ? raw : "landing";
  }

  function go(screen, { seed } = {}) {
    if (seed !== undefined) setSeedParam(seed);
    if (current() === screen) {
      apply();
      return;
    }
    location.hash = `#/${screen}`;
  }

  function seedParam() {
    return new URLSearchParams(location.search).get("c");
  }

  /** Rewrites `?c=` without adding a history entry or reloading. */
  function setSeedParam(seed) {
    const url = new URL(location.href);
    if (seed) url.searchParams.set("c", seed);
    else url.searchParams.delete("c");
    history.replaceState(null, "", url);
  }

  function apply() {
    const screen = current();
    document.body.dataset.screen = screen;
    for (const fn of listeners) fn(screen);
  }

  function onRoute(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function init() {
    window.addEventListener("hashchange", apply);
    apply();
  }

  VF.router = { SCREENS, current, go, onRoute, seedParam, setSeedParam, init, apply };
})(window.VF);
