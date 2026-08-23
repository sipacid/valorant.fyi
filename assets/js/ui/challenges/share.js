// share.js — the seeded link.
//
// The URL carries the challenge seed and nothing else. No agent: a team can't
// run duplicates, so everyone rolls their own.

(function (VF) {
  "use strict";

  const shareUrl = (seedStr) =>
    `${location.origin}${location.pathname}?c=${encodeURIComponent(seedStr)}#/run`;

  /**
   * Copies the share link, reporting which route worked so the caller can say
   * something useful either way.
   *
   * Three tiers, because the async clipboard API needs a secure context and a
   * user-gesture-scoped permission that plain http and some file:// setups don't
   * grant — and this site is explicitly meant to work from file://.
   *
   * @returns {Promise<{ok: boolean, via: "clipboard"|"execCommand"|"prompt", url: string}>}
   */
  async function copy(seedStr) {
    const url = shareUrl(seedStr);

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        return { ok: true, via: "clipboard", url };
      }
    } catch {
      // Fall through — blocked context, not a reason to give up.
    }

    // Deprecated but still widely supported, and works in contexts the async API
    // refuses. Beats opening a modal dialog the user has to dismiss.
    try {
      const field = VF.el("textarea", { value: url, readOnly: true });
      field.setAttribute("aria-hidden", "true");
      // Off-screen rather than display:none, which isn't selectable.
      field.style.cssText = "position:fixed;top:-1000px;left:-1000px;opacity:0";
      document.body.appendChild(field);
      field.select();
      field.setSelectionRange(0, url.length);
      const ok = document.execCommand("copy");
      field.remove();
      if (ok) return { ok: true, via: "execCommand", url };
    } catch {
      // Fall through to the dialog.
    }

    window.prompt("Copy this link:", url);
    return { ok: false, via: "prompt", url };
  }

  VF.share = { shareUrl, copy };
})(window.VF);
