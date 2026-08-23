window.VF ||= {};

(function (VF) {
  "use strict";

  VF.el = function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "dataset") Object.assign(node.dataset, value);
      else if (key.startsWith("aria-") || key.startsWith("data-")) node.setAttribute(key, value);
      else if (key.startsWith("on") && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else node[key] = value;
    }
    for (const child of [].concat(children)) {
      if (child == null || child === false) continue;
      node.append(child);
    }
    return node;
  };

  VF.qs = (selector, root = document) => root.querySelector(selector);

  let toastEl = null;
  let toastTimer = null;

  VF.toast = function toast(text, tone) {
    if (!toastEl) {
      toastEl = VF.el("div", { id: "vf-toast", role: "status", "aria-live": "polite" });
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.className = `vf-toast vf-toast--${tone || "ok"}`;
    toastEl.classList.remove("is-on");
    void toastEl.offsetWidth;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 2600);
    return toastEl;
  };

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

  VF.makeOverlay = function makeOverlay(element, hooks = {}) {
    if (!element) return { open() {}, close() {}, isOpen: () => false };
    const { onOpen, onClose } = hooks;
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
