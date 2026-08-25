// tamper.js — catches the obvious "edit the score in devtools" cheat.
//
// This is a gag, not security. There's no backend, so a determined person can
// disable JS or rewrite localStorage and we'd never know. What this does catch
// is the five-second version: inspect the score, type 9000, screenshot it. The
// number snaps back and the page becomes unusable until they reload.

(function (VF) {
  "use strict";

  let busted = false;

  /** How long they get to enjoy the chaos before the payoff. */
  const REDIRECT_MS = 10000;
  const PAYOFF_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

  /**
   * Watches a score element and hands back the only sanctioned way to write to
   * it. Any change we didn't make is treated as tampering.
   *
   * @param {HTMLElement} el the score element
   * @returns {(value: any) => void} setter, with a `.stop()` to disconnect
   */
  function watchScore(el) {
    let expected = el.textContent;
    let restoring = false;

    const observer = new MutationObserver(() => {
      // Our own restore re-enqueues a mutation; ignore that pass.
      if (restoring || busted) return;
      if (el.textContent === expected) return;
      restoring = true;
      el.textContent = expected;
      restoring = false;
      trip(el);
    });
    observer.observe(el, { childList: true, characterData: true, subtree: true });

    function setScore(value) {
      if (busted) return; // don't let a later sync() quietly undo the gag
      expected = String(value);
      restoring = true;
      el.textContent = expected;
      restoring = false;
    }

    setScore.stop = () => observer.disconnect();
    return setScore;
  }

  /**
   * One-shot. Nothing turns this off — ten seconds of chaos, then the payoff.
   * A reload during those ten seconds is the only way out.
   */
  function trip(el) {
    if (busted) return;
    busted = true;
    document.body.classList.add("is-busted");
    if (el) el.textContent = "CHEATER";
    VF.toast("Nice try.", "warn");
    VF.audio.rickroll();
    setTimeout(() => {
      // assign, not replace — Back brings them to a clean load of the site.
      window.location.assign(PAYOFF_URL);
    }, REDIRECT_MS);
  }

  VF.tamper = { watchScore, trip, isBusted: () => busted };
})(window.VF);
