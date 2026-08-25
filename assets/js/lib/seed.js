// seed.js — the shareable card code.
//
// A seed is a packed 40-bit payload rendered as base36 (<= 8 chars), carried in
// the URL as `?c=<seed>`. It describes *how* a card was generated, not the card
// itself, so `?c=3k9f2a` regenerates the identical card on any client.
//
// Deliberately absent: the agent. A team can't run duplicate agents, so each
// player rolls their own — the seed covers the challenges only.

(function (VF) {
  "use strict";

  // 2 added the `tier` field. A format bump rather than a silent layout change:
  // an older seed would decode into different values for every field after the
  // insertion point, and showing someone a subtly different card is worse than
  // telling them the link is stale.
  //
  // 3 changed nothing about the layout — it retires every older seed on purpose.
  // Tile selection gained a per-family cap, so a v2 seed would still decode but
  // would build a different card than the person who shared it is looking at.
  // Same reasoning: a dead link beats a silently divergent one.
  const SEED_FORMAT = 3;

  /**
   * Bumped on every catalog append. Baked into the seed so a card made today
   * still regenerates exactly after the catalog grows — see VF.pool.resolve.
   */
  const CATALOG_VERSION = 2;

  const MODES = ["bingo", "draw", "ruleset", "gauntlet"];

  const OPT_FREE_CENTER = 1; // bit 0 — bingo's free middle square
  // bit 1 was OPT_BALANCED (superseded by `tier`), reused in format 3.
  const OPT_NO_MEME = 2; // bit 1 — drop everything tagged `meme` from the pool

  /**
   * How hard the card should feel. Independent of `diffMask`: the mask decides
   * which difficulties may appear at all, the tier decides how much of the card
   * the hard ones take up. See VF.runState.TIERS for the weights.
   */
  const TIER_IDS = ["easy", "medium", "hard", "brutal"];

  // LSB -> MSB, 42 bits total. Stays exact in a double, which matters because we
  // pack with multiplication: JS bitwise operators truncate to 32.
  const FIELDS = [
    ["fmt", 3],
    ["catalog", 8],
    ["mode", 3],
    ["agentMode", 2], // 0 = any agent, 1 = locked to whichever agent you rolled
    ["diffMask", 4], // bit i set => difficulty (i + 1) allowed
    ["tier", 2], // index into TIER_IDS
    ["opts", 2],
    ["nonce", 18], // what actually makes two cards differ
  ];

  function encodeSeed(fields) {
    let value = 0;
    let multiplier = 1;
    for (const [key, bits] of FIELDS) {
      const max = 2 ** bits;
      const raw = Math.floor(fields[key] ?? 0);
      if (!Number.isFinite(raw) || raw < 0 || raw >= max) {
        throw new RangeError(`seed field ${key} out of range: ${fields[key]}`);
      }
      value += raw * multiplier;
      multiplier *= max;
    }
    return value.toString(36);
  }

  function decodeSeed(str) {
    if (!/^[0-9a-z]{1,9}$/.test(String(str ?? ""))) return null;
    let value = parseInt(str, 36);
    if (!Number.isFinite(value) || value < 0) return null;
    const out = {};
    for (const [key, bits] of FIELDS) {
      const max = 2 ** bits;
      out[key] = value % max;
      value = Math.floor(value / max);
    }
    if (value !== 0) return null; // trailing garbage
    if (out.fmt !== SEED_FORMAT) return null; // a format we don't understand
    out.raw = String(str);
    out.modeName = MODES[out.mode] ?? null;
    if (!out.modeName) return null;
    if (!out.diffMask) return null; // no difficulties allowed => no card
    out.tierId = TIER_IDS[out.tier] ?? TIER_IDS[1];
    return out;
  }

  function newSeed({ mode, agentMode = 0, diffMask = 0b1111, tier = 1, opts = 0 }) {
    const index = MODES.indexOf(mode);
    if (index < 0) throw new Error(`unknown mode: ${mode}`);
    return encodeSeed({
      fmt: SEED_FORMAT,
      catalog: CATALOG_VERSION,
      mode: index,
      agentMode,
      diffMask,
      tier: typeof tier === "string" ? Math.max(0, TIER_IDS.indexOf(tier)) : tier,
      opts,
      // Unseeded on purpose — this is the one place a card gets its identity.
      nonce: Math.floor(Math.random() * 2 ** 18),
    });
  }

  /**
   * Whether this client can render a card made by `seed`.
   *
   * A seed from a *newer* catalog than we know about can't be reproduced —
   * rendering it anyway would silently show a different card to that player,
   * which is the worst possible outcome for a mode built on everyone agreeing.
   */
  function compatibility(seed) {
    if (!seed) return { ok: false, reason: "invalid" };
    if (seed.catalog > CATALOG_VERSION) return { ok: false, reason: "stale-client" };
    return { ok: true, reason: null };
  }

  /**
   * The PRNG is keyed off the whole encoded string, so changing any field —
   * including the catalog version — yields a completely different card.
   * `salt` keeps independent draws within one card from correlating.
   */
  const seedRng = (seedStr, salt = "") => VF.rng.rngFromString(`${seedStr}|${salt}`);

  VF.seed = {
    SEED_FORMAT,
    CATALOG_VERSION,
    MODES,
    TIER_IDS,
    OPT_FREE_CENTER,
    OPT_NO_MEME,
    FIELDS,
    encodeSeed,
    decodeSeed,
    newSeed,
    compatibility,
    seedRng,
  };
})(window.VF);
