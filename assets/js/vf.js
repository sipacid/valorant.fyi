// vf.js — the shared namespace. MUST be the first script on the page.
//
// The site deliberately uses plain <script> tags rather than ES modules so it
// keeps working from file:// and from any dumb static host, with no build step
// and no dev server. The cost is that load order in index.html is load-bearing;
// every file below assigns onto this one object.

window.VF = window.VF || {};

(function (VF) {
  "use strict";

  /**
   * Terse element builder. `props` sets properties (not attributes) except for
   * `class`, `dataset` and anything starting with `aria-`/`data-`.
   *
   * @param {string} tag
   * @param {Object} [props]
   * @param {(Node|string)[]|Node|string} [children]
   * @returns {HTMLElement}
   */
  VF.el = function el(tag, props, children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value === null || value === undefined || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "dataset") Object.assign(node.dataset, value);
      else if (key.startsWith("aria-") || key.startsWith("data-")) node.setAttribute(key, value);
      else if (key.startsWith("on") && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else node[key] = value;
    }
    for (const child of [].concat(children ?? [])) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child);
    }
    return node;
  };

  VF.qs = (selector, root) => (root || document).querySelector(selector);

  let toastEl = null;
  let toastTimer = null;

  /**
   * Brief confirmation pinned to the bottom of the viewport.
   *
   * Lives on <body> rather than inside a screen on purpose: the challenge screen
   * is display:none while the carousel is taken over for a draw, so a message
   * placed in there is invisible exactly when the draw's Share button needs it.
   *
   * @param {string} text
   * @param {"ok"|"warn"} [tone]
   */
  VF.toast = function toast(text, tone) {
    if (!toastEl) {
      toastEl = VF.el("div", { id: "vf-toast", role: "status", "aria-live": "polite" });
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.className = `vf-toast vf-toast--${tone || "ok"}`;
    // Restart the animation on a repeat press instead of letting it sit still.
    toastEl.classList.remove("is-on");
    void toastEl.offsetWidth;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 2600);
    return toastEl;
  };

  /**
   * Momentarily swaps a button's label, so confirmation appears where the eye
   * already is rather than only at the edge of the screen.
   */
  VF.confirmButton = function confirmButton(button, label, ms = 2000) {
    if (!button) return;
    if (button.dataset.restoreLabel === undefined) {
      button.dataset.restoreLabel = button.textContent;
    }
    button.textContent = label;
    button.classList.add("is-copied");
    clearTimeout(Number(button.dataset.restoreTimer));
    button.dataset.restoreTimer = String(
      setTimeout(() => {
        button.textContent = button.dataset.restoreLabel;
        button.classList.remove("is-copied");
        delete button.dataset.restoreLabel;
      }, ms),
    );
  };

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /**
   * Wires an element to behave like a modal overlay: `hidden` + `aria-hidden`
   * toggling (the convention the agent-pool overlay already used), plus
   * Escape-to-close and a focus trap, which it previously lacked.
   *
   * @param {HTMLElement} element
   * @param {{onOpen?: Function, onClose?: Function}} [hooks]
   */
  VF.makeOverlay = function makeOverlay(element, hooks) {
    if (!element) return { open() {}, close() {}, isOpen: () => false };
    const { onOpen, onClose } = hooks || {};
    let lastFocused = null;

    const isOpen = () => !element.hidden;

    function onKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const items = [...element.querySelectorAll(FOCUSABLE)].filter(
        (node) => node.offsetParent !== null,
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function open() {
      if (isOpen()) return;
      lastFocused = document.activeElement;
      element.hidden = false;
      element.setAttribute("aria-hidden", "false");
      document.addEventListener("keydown", onKeydown);
      if (onOpen) onOpen();
      const target = element.querySelector(FOCUSABLE);
      if (target) target.focus();
    }

    function close() {
      if (!isOpen()) return;
      element.hidden = true;
      element.setAttribute("aria-hidden", "true");
      document.removeEventListener("keydown", onKeydown);
      if (onClose) onClose();
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    return { open, close, isOpen, element };
  };
})(window.VF);
