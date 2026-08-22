// icons.js — picks one icon per challenge and renders it.
//
// Art (agent portraits, ability icons, weapon silhouettes) is downloaded and
// committed by tools/generate-agents.mjs, never fetched at runtime. Everything
// the art can't cover falls back to a hand-drawn SVG glyph, so every challenge
// gets something.
//
// `resolve` is deliberately pure and DOM-free so tools/selftest.mjs can check
// the mapping across the whole catalog without a browser.

(function (VF) {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  /**
   * Stroked rather than filled: far easier to keep visually consistent, and a
   * single `currentColor` stroke themes cleanly against the dark background.
   */
  const GLYPHS = {
    // Valorant-style kill emblem: angular helmet with a pointed chin, split down
    // the centre, inside a ring. Stroked like the rest of the set so it tints
    // with currentColor and holds up from a 20px row icon to a tile watermark.
    skull: [
      ["circle", { cx: 12, cy: 12, r: 9.4 }],
      ["path", { d: "M12 4.6 6.9 7.6v4.7c0 1.6.7 2.7 1.7 3.6l1.5 1.3L12 19.4l1.9-2.2 1.5-1.3c1-.9 1.7-2 1.7-3.6V7.6L12 4.6Z" }],
      ["path", { d: "M8.6 10.3 11 11.4l-.7 2.4-2.1-1-.4-1.8.8-.7Z" }],
      ["path", { d: "M15.4 10.3 13 11.4l.7 2.4 2.1-1 .4-1.8-.8-.7Z" }],
      // Split drawn only above and below the eyes — running it through the face
      // turned the whole emblem into a blob at row size.
      ["path", { d: "M12 4.6v4.2M12 14.6v4.8" }],
    ],
    spike: [
      ["rect", { x: 7, y: 6, width: 10, height: 13, rx: 2 }],
      ["path", { d: "M9.5 6V4.5a2.5 2.5 0 0 1 5 0V6" }],
      ["path", { d: "M10 10.5h4M10 14h4" }],
    ],
    crosshair: [
      ["circle", { cx: 12, cy: 12, r: 7 }],
      ["path", { d: "M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" }],
      ["circle", { cx: 12, cy: 12, r: 1.4 }],
    ],
    boots: [
      ["path", { d: "M7.5 3.5h4V11l5 2.4V19a1 1 0 0 1-1 1H8.5a1 1 0 0 1-1-1V3.5Z" }],
      ["path", { d: "M7.5 15.5h9" }],
    ],
    shield: [
      ["path", { d: "M12 3 5 6v5.6c0 4.2 2.9 7.4 7 9.4 4.1-2 7-5.2 7-9.4V6l-7-3Z" }],
    ],
    coin: [
      ["circle", { cx: 12, cy: 12, r: 8 }],
      ["circle", { cx: 12, cy: 12, r: 4.6 }],
      ["path", { d: "M12 6.2v1.4M12 16.4v1.4" }],
    ],
    chat: [
      ["path", { d: "M20 5H4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3v3.6L11.6 16H20a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z" }],
    ],
    clock: [
      ["circle", { cx: 12, cy: 12, r: 8 }],
      ["path", { d: "M12 7.2V12l3.1 2.1" }],
    ],
    star: [
      ["path", { d: "m12 3.2 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6L3.2 9.6l6.1-.9L12 3.2Z" }],
    ],
  };

  const GLYPH_NAMES = Object.keys(GLYPHS);

  /**
   * Rules carry a conflictGroup that already says what kind of handicap they
   * are, which is a better signal than their tags.
   */
  const GROUP_GLYPH = {
    "primary-weapon": "skull",
    aim: "crosshair",
    movement: "boots",
    utility: "star",
    economy: "coin",
    comms: "chat",
    tempo: "clock",
    site: "spike",
  };

  const TAG_GLYPH = {
    meme: "chat",
    social: "chat",
    comms: "chat",
    economy: "coin",
    movement: "boots",
    aim: "crosshair",
    site: "spike",
    tempo: "clock",
    support: "shield",
    gunplay: "skull",
  };

  // Ordered most-specific first: plenty of challenges mention both a kill and a
  // spike, and "plant the spike then clutch" reads better as a spike.
  const TEXT_GLYPH = [
    [/\b(plant|defus|spike|site|retake)/i, "spike"],
    [/\b(credit|buy|buys|eco|thrift|save|shield|spend)/i, "coin"],
    [/\b(surviv|heal|resurrect|assist|revive|damage|dying|deathless|losing)/i, "shield"],
    [/\b(walk|run|jump|crouch|slide|dash|peek|rotate|movement)/i, "boots"],
    // \d+k catches "Get a 3K in a single round", which says nothing about killing.
    [/\b(ace|kill|kills|frag|headshot|collateral|wallbang|clutch|1v\d|\d+k)\b/i, "skull"],
    [/\b(second|seconds|timer|first|fast|opening)/i, "clock"],
    [/\b(comms|chat|call|ping|spray|emote)/i, "chat"],
  ];

  let weaponIcons = null;
  function weaponIcon(name) {
    if (!weaponIcons) {
      weaponIcons = new Map((VF.WEAPONS || []).map((w) => [w.name, w.icon]));
    }
    return weaponIcons.get(name) || null;
  }

  function glyphFor(entry) {
    if (entry.conflictGroup && GROUP_GLYPH[entry.conflictGroup]) {
      return GROUP_GLYPH[entry.conflictGroup];
    }
    for (const tag of entry.tags || []) {
      if (TAG_GLYPH[tag]) return TAG_GLYPH[tag];
    }
    for (const [pattern, glyph] of TEXT_GLYPH) {
      if (pattern.test(entry.text)) return glyph;
    }
    return "star";
  }

  /**
   * One icon per challenge, most specific wins.
   *
   * @param {Object} entry a catalog entry
   * @param {Object|null} agent the locked agent, if any
   * @returns {{kind: "art"|"glyph", src?: string, glyph?: string, label: string}}
   */
  function resolve(entry, agent) {
    if (!entry) return { kind: "glyph", glyph: "star", label: "" };

    // An explicit override on the entry beats everything.
    if (entry.icon && GLYPHS[entry.icon]) {
      return { kind: "glyph", glyph: entry.icon, label: entry.icon };
    }

    // 1. The ability this challenge is actually about — only knowable once an
    //    agent is locked in, which is the whole point of agent-locked cards.
    if (entry.slots && entry.slots.length && agent && agent.abilityIcons) {
      const slot = entry.slots[0];
      const src = agent.abilityIcons[slot];
      if (src) return { kind: "art", src, label: agent.abilities[slot] || agent.title };
    }

    // 2. A named agent.
    if (entry.agent) {
      const named = VF.AGENTS_BY_TITLE.get(entry.agent);
      if (named && named.icon) return { kind: "art", src: named.icon, label: named.title };
    }

    // 3. A named weapon.
    if (entry.weapon) {
      const src = weaponIcon(entry.weapon);
      if (src) return { kind: "art", src, label: entry.weapon };
    }

    const glyph = glyphFor(entry);
    return { kind: "glyph", glyph, label: glyph };
  }

  function svg(glyph, className) {
    const node = document.createElementNS(SVG_NS, "svg");
    node.setAttribute("viewBox", "0 0 24 24");
    node.setAttribute("fill", "none");
    node.setAttribute("stroke", "currentColor");
    node.setAttribute("stroke-width", "1.6");
    node.setAttribute("stroke-linecap", "round");
    node.setAttribute("stroke-linejoin", "round");
    node.setAttribute("aria-hidden", "true");
    node.setAttribute("class", className);
    for (const [tag, attrs] of GLYPHS[glyph] || GLYPHS.star) {
      const child = document.createElementNS(SVG_NS, tag);
      for (const [key, value] of Object.entries(attrs)) child.setAttribute(key, String(value));
      node.appendChild(child);
    }
    return node;
  }

  /**
   * @param {string} variant "watermark" | "inline" | "large"
   * @returns {Element} always decorative — the challenge text already names the
   *   agent, ability or weapon, so announcing it again is just noise.
   */
  function render(entry, agent, variant = "inline") {
    const resolved = resolve(entry, agent);
    const className = `challenge-icon challenge-icon--${variant} challenge-icon--${resolved.kind}`;

    if (resolved.kind === "art") {
      return VF.el("img", {
        src: resolved.src,
        alt: "",
        "aria-hidden": "true",
        loading: "lazy",
        decoding: "async",
        class: className,
      });
    }
    return svg(resolved.glyph, className);
  }

  VF.icons = { GLYPHS, GLYPH_NAMES, resolve, render, glyphFor };
})(window.VF);
