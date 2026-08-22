// manage.js — the "Challenge Pool" overlay: turn built-in challenges off, and
// add your own. Mirrors the agent-pool overlay's structure and vocabulary.
//
// Everything here is local. Seeded/shared cards deliberately ignore all of it —
// see VF.pool.resolve — otherwise two people on the same link would see
// different cards.

(function (VF) {
  "use strict";

  const overlayEl = VF.qs("#manage-overlay");
  const listEl = VF.qs("#manage-list");
  const searchEl = VF.qs("#manage-search");
  const kindEl = VF.qs("#manage-kind");
  const countEl = VF.qs("#manage-count");
  const formEl = VF.qs("#manage-add");
  const agentSelectEl = VF.qs("#manage-add-agent");
  const noticeEl = VF.qs("#manage-notice");

  let rows = [];
  let searchTimer = null;
  let noticeTimer = null;

  function allEntries() {
    return [...VF.catalog.CATALOG.filter((e) => e.removedIn === null), ...VF.pool.getCustom()].sort(
      VF.pool.byId,
    );
  }

  function buildRow(entry, disabled) {
    const enabled = !disabled.has(entry.id);
    const checkbox = VF.el("input", {
      type: "checkbox",
      class: "manage-check",
      checked: enabled,
      onChange() {
        VF.pool.setEnabled(entry.id, checkbox.checked);
        row.classList.toggle("is-off", !checkbox.checked);
        syncCount();
      },
    });

    const label = VF.el("label", { class: "manage-row-main" }, [
      checkbox,
      // No agent context in the pool list, so slot templates land on a glyph.
      VF.icons.render(entry, null, "row"),
      VF.el("span", { class: "manage-row-text", textContent: entry.text }),
    ]);

    const tags = VF.el("div", { class: "manage-row-tags" }, [
      VF.el("span", {
        class: `difficulty-pip difficulty-pip--${entry.difficulty}`,
        "aria-label": `Difficulty ${entry.difficulty} of 4`,
        title: `Difficulty ${entry.difficulty} of 4`,
      }),
      VF.el("span", {
        class: `manage-kind manage-kind--${entry.kind}`,
        textContent: entry.kind === "rule" ? "RULE" : "OBJ",
      }),
      entry.agent ? VF.el("span", { class: "manage-agent", textContent: entry.agent }) : null,
      entry.custom
        ? VF.el("button", {
            type: "button",
            class: "manage-delete",
            textContent: "Delete",
            title: "Delete this custom challenge",
            onClick() {
              VF.pool.removeCustom(entry.id);
              refresh();
            },
          })
        : null,
    ]);

    const row = VF.el("li", { class: `manage-row${enabled ? "" : " is-off"}` }, [label, tags]);
    row.dataset.search = `${entry.text} ${entry.agent ?? ""} ${entry.tags.join(" ")}`.toLowerCase();
    row.dataset.kind = entry.kind;
    row.dataset.custom = String(Boolean(entry.custom));
    return row;
  }

  function refresh() {
    if (!listEl) return;
    const disabled = VF.pool.getDisabled();
    const entries = allEntries();
    listEl.innerHTML = "";
    rows = entries.map((entry) => buildRow(entry, disabled));
    for (const row of rows) listEl.appendChild(row);
    applyFilter();
    syncCount();
  }

  function applyFilter() {
    const query = (searchEl?.value ?? "").trim().toLowerCase();
    const kind = kindEl?.value ?? "all";
    for (const row of rows) {
      const matchesKind =
        kind === "all" ||
        (kind === "custom" ? row.dataset.custom === "true" : row.dataset.kind === kind);
      const matchesQuery = !query || row.dataset.search.includes(query);
      row.hidden = !(matchesKind && matchesQuery);
    }
    syncCount();
  }

  function syncCount() {
    if (!countEl) return;
    const disabled = VF.pool.getDisabled();
    const entries = allEntries();
    // Counted against the entries that actually exist: the disabled set can hold
    // ids of custom challenges that have since been deleted, so its raw size
    // would undercount.
    const enabled = entries.filter((e) => !disabled.has(e.id)).length;
    const visible = rows.filter((row) => !row.hidden).length;
    countEl.textContent = `${enabled} of ${entries.length} enabled · showing ${visible}`;
  }

  function setAll(enabled) {
    if (enabled) {
      VF.pool.setDisabled(new Set());
    } else {
      VF.pool.setDisabled(new Set(allEntries().map((e) => e.id)));
    }
    refresh();
  }

  function addCustom({ text, kind, difficulty, scope, agent }) {
    const slots = [...text.matchAll(VF.catalog.SLOT_RE)].map((m) => m[1]);
    const entry = VF.catalog.finalize({
      id: `usr.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 6)}`,
      kind,
      text,
      slots,
      difficulty,
      scope,
      tags: ["custom"],
      agent: agent || null,
      since: 0,
      custom: true,
    });
    // Custom challenges can never enter a seeded pool — that is what stops a
    // shared card from desyncing between two players.
    entry.sharable = false;
    const hadCustom = VF.pool.getCustom().length > 0;
    VF.pool.addCustom(entry);

    // Writing a challenge and then never seeing it is a dead end — the reason
    // was a separate toggle nobody knew to look for. Turn it on and say so.
    const prefs = VF.runState.loadPrefs();
    if (!prefs.local) {
      prefs.local = true;
      VF.runState.savePrefs(prefs);
      announce(
        hadCustom
          ? "Your own challenges are now included in your runs."
          : "Added — and your own challenges are now switched on. Cards using them can't be shared.",
      );
      VF.challenges.renderPicker();
    } else {
      announce("Added to your pool.");
    }
    return entry;
  }

  function announce(text) {
    if (!noticeEl) return;
    noticeEl.textContent = text;
    noticeEl.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      noticeEl.hidden = true;
    }, 6000);
  }

  function populateAgentSelect() {
    if (!agentSelectEl || agentSelectEl.options.length > 1) return;
    for (const agent of VF.cardsData) {
      agentSelectEl.appendChild(VF.el("option", { value: agent.title, textContent: agent.title }));
    }
  }

  const overlay = VF.makeOverlay(overlayEl, {
    onOpen() {
      populateAgentSelect();
      refresh();
    },
  });

  if (searchEl) {
    searchEl.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(applyFilter, 120);
    });
  }
  if (kindEl) kindEl.addEventListener("change", applyFilter);
  VF.qs("#manage-all")?.addEventListener("click", () => setAll(true));
  VF.qs("#manage-none")?.addEventListener("click", () => setAll(false));
  VF.qs("#manage-done")?.addEventListener("click", () => overlay.close());

  if (formEl) {
    formEl.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(formEl);
      const text = String(data.get("text") ?? "").trim();
      if (!text) return;
      addCustom({
        text,
        kind: String(data.get("kind") ?? "objective"),
        difficulty: Number(data.get("difficulty") ?? 2),
        scope: String(data.get("scope") ?? "match"),
        agent: String(data.get("agent") ?? ""),
      });
      formEl.reset();
      refresh();
      VF.audio.cue("mark");
    });
  }

  VF.manage = { open: overlay.open, close: overlay.close, addCustom, refresh };
})(window.VF);
