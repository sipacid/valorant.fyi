#!/usr/bin/env node
/**
 * Logic self-test. DEV-ONLY, never shipped.
 *
 * The site has no test framework and the browser-only files need a DOM, but the
 * parts most likely to break silently — seed round-tripping, catalog integrity,
 * and whether two clients really do build the identical card — are pure
 * functions. This loads just those files against a stub `window` and checks them.
 *
 *     node tools/selftest.mjs
 */

import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Enough of a DOM for the data/lib layer. Anything that touches real elements
// lives in ui/ and isn't loaded here.
const store = new Map();
const sandbox = {
  console,
  Math,
  Date,
  JSON,
  Set,
  Map,
  RegExp,
  Number,
  Object,
  Array,
  String,
  Boolean,
  Error,
  RangeError,
  parseInt,
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const FILES = [
  "assets/js/vf.js",
  "assets/js/data/agents.js",
  "assets/js/data/weapons.js",
  "assets/js/lib/rng.js",
  "assets/js/lib/store.js",
  "assets/js/lib/seed.js",
  "assets/js/data/catalog.js",
  "assets/js/lib/pool.js",
  "assets/js/ui/icons.js",
  "assets/js/ui/challenges/state.js",
  "assets/js/ui/challenges/bingo.js",
];

for (const file of FILES) {
  const code = await readFile(join(ROOT, file), "utf8");
  vm.runInContext(code, sandbox, { filename: file });
}

const VF = sandbox.VF;

let failures = 0;
let checks = 0;

function check(label, condition, detail) {
  checks += 1;
  if (condition) return;
  failures += 1;
  console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
}

function section(name) {
  console.log(`\n${name}`);
}

// ------------------------------------------------------------------
section("rng");

const a = VF.rng.rngFromString("abc");
const b = VF.rng.rngFromString("abc");
const first = [a(), a(), a(), a(), a()];
const second = [b(), b(), b(), b(), b()];
check("same string yields the same stream", JSON.stringify(first) === JSON.stringify(second));
check("values stay in [0,1)", first.every((v) => v >= 0 && v < 1), JSON.stringify(first));
check(
  "different strings diverge",
  VF.rng.rngFromString("abc")() !== VF.rng.rngFromString("abd")(),
);

const source = Array.from({ length: 50 }, (_, i) => i);
const shuffleA = VF.rng.seededShuffle(source, VF.rng.rngFromString("s"));
const shuffleB = VF.rng.seededShuffle(source, VF.rng.rngFromString("s"));
check("seeded shuffle is deterministic", JSON.stringify(shuffleA) === JSON.stringify(shuffleB));
check("seeded shuffle is a permutation", [...shuffleA].sort((x, y) => x - y).join() === source.join());

// ------------------------------------------------------------------
section("seed codec");

let roundTripFailures = 0;
for (let i = 0; i < 20000; i++) {
  const fields = {
    fmt: VF.seed.SEED_FORMAT,
    catalog: Math.floor(Math.random() * 256),
    mode: Math.floor(Math.random() * 4),
    agentMode: Math.floor(Math.random() * 4),
    diffMask: 1 + Math.floor(Math.random() * 15),
    tier: Math.floor(Math.random() * 4),
    opts: Math.floor(Math.random() * 4),
    nonce: Math.floor(Math.random() * 2 ** 18),
  };
  const encoded = VF.seed.encodeSeed(fields);
  const decoded = VF.seed.decodeSeed(encoded);
  if (!decoded) {
    roundTripFailures += 1;
    continue;
  }
  for (const [key, value] of Object.entries(fields)) {
    if (decoded[key] !== value) roundTripFailures += 1;
  }
  if (encoded.length > 9 || !/^[0-9a-z]+$/.test(encoded)) roundTripFailures += 1;
}
check("20k random seeds round-trip exactly", roundTripFailures === 0, `${roundTripFailures} mismatches`);

check("garbage is rejected", VF.seed.decodeSeed("!!!") === null);
check("empty is rejected", VF.seed.decodeSeed("") === null);
check("null is rejected", VF.seed.decodeSeed(null) === null);
check("encoded seeds are 9 chars or fewer", VF.seed.newSeed({ mode: "bingo" }).length <= 9);
check(
  "an all-difficulties-off seed is rejected",
  VF.seed.decodeSeed(
    VF.seed.encodeSeed({ fmt: VF.seed.SEED_FORMAT, catalog: 1, mode: 0, agentMode: 0, diffMask: 0, tier: 1, opts: 0, nonce: 1 }),
  ) === null,
);
check(
  "an older seed format is rejected rather than misparsed",
  VF.seed.decodeSeed(
    VF.seed.encodeSeed({ fmt: 1, catalog: 1, mode: 0, agentMode: 0, diffMask: 15, tier: 1, opts: 0, nonce: 1 }),
  ) === null,
);
check(
  "a future seed format is rejected",
  VF.seed.decodeSeed(
    VF.seed.encodeSeed({ fmt: 7, catalog: 1, mode: 0, agentMode: 0, diffMask: 15, tier: 1, opts: 0, nonce: 1 }),
  ) === null,
);
check("tier round-trips to an id", VF.seed.decodeSeed(VF.seed.newSeed({ mode: "bingo", tier: 3 })).tierId === "brutal");

const futureSeed = VF.seed.decodeSeed(
  VF.seed.encodeSeed({
    fmt: VF.seed.SEED_FORMAT,
    catalog: VF.seed.CATALOG_VERSION + 2,
    mode: 0,
    agentMode: 0,
    diffMask: 15,
    tier: 1,
    opts: 0,
    nonce: 7,
  }),
);
check("a newer catalog is flagged as stale-client", VF.seed.compatibility(futureSeed).reason === "stale-client");

check("newSeed produces decodable seeds", Boolean(VF.seed.decodeSeed(VF.seed.newSeed({ mode: "bingo" }))));
check(
  "newSeed rejects unknown modes",
  (() => {
    try {
      VF.seed.newSeed({ mode: "nope" });
      return false;
    } catch {
      return true;
    }
  })(),
);

// ------------------------------------------------------------------
section("catalog");

const problems = VF.catalog.assertIntegrity();
check("catalog has no integrity problems", problems.length === 0, `${problems.length} problems`);

const { CATALOG } = VF.catalog;
check("catalog is sorted by id", CATALOG.every((e, i) => i === 0 || CATALOG[i - 1].id <= e.id));
check("every entry has points", CATALOG.every((e) => e.points > 0));
check(
  "agent-specific entries are never sharable",
  CATALOG.every((e) => !e.agent || !e.sharable),
);
check(
  "slot templates render the agent's ability name",
  VF.catalog.renderChallengeText(
    CATALOG.find((e) => e.slots.includes("E") && e.id.startsWith("obj.slot.hoard")),
    VF.AGENTS_BY_TITLE.get("Skye"),
  ).includes("Guiding Light"),
);
check(
  "slot templates fall back to a generic label",
  VF.catalog
    .renderChallengeText(
      CATALOG.find((e) => e.slots.includes("E") && e.id.startsWith("obj.slot.hoard")),
      null,
    )
    .includes("signature ability"),
);
check(
  "every agent has combos",
  VF.cardsData.every((agent) => CATALOG.some((e) => e.agent === agent.title)),
  VF.cardsData.filter((agent) => !CATALOG.some((e) => e.agent === agent.title)).map((a) => a.title).join(", "),
);

const sharable = CATALOG.filter((e) => e.sharable);
check("enough sharable objectives for a bingo card", sharable.filter((e) => e.kind === "objective").length >= 25);
check("enough sharable rules for a contract", sharable.filter((e) => e.kind === "rule").length >= 2);

// ------------------------------------------------------------------
section("pool + shared-card determinism");

function buildTiles(seedStr) {
  const seed = VF.seed.decodeSeed(seedStr);
  const { pool } = VF.pool.resolve({ seed });
  const objectives = pool.filter((e) => e.kind === "objective");
  return VF.rng
    .seededShuffle(objectives, VF.seed.seedRng(seedStr, "bingo:tiles"))
    .slice(0, 25)
    .map((e) => e.id);
}

const sharedSeed = VF.seed.newSeed({ mode: "bingo", agentMode: 1, diffMask: 0b1111, opts: 0 });
const clientA = buildTiles(sharedSeed);

// Client B has wildly different local settings. A shared card must ignore them.
sandbox.localStorage.setItem(
  "valorant.fyi/challenges/disabled",
  JSON.stringify(CATALOG.slice(0, 120).map((e) => e.id)),
);
sandbox.localStorage.setItem(
  "valorant.fyi/challenges/custom",
  JSON.stringify(
    Array.from({ length: 5 }, (_, i) =>
      VF.catalog.finalize({
        id: `usr.test.${i}`,
        kind: "objective",
        text: `custom ${i}`,
        difficulty: 2,
        custom: true,
      }),
    ),
  ),
);
const clientB = buildTiles(sharedSeed);

check("two clients build identical shared cards", JSON.stringify(clientA) === JSON.stringify(clientB));
check("shared card has 25 tiles", clientA.length === 25);
check("shared card has no duplicate tiles", new Set(clientA).size === clientA.length);
check("shared card contains no custom challenges", clientA.every((id) => !id.startsWith("usr.")));
check(
  "shared card contains no agent-specific challenges",
  clientA.every((id) => !VF.catalog.get(id).agent),
);

// A local run, by contrast, must honour the local settings.
const localPool = VF.pool.resolve({ seed: null, agentMode: 1, diffMask: 0b1111 }).pool;
check("local run includes custom challenges", localPool.some((e) => e.id.startsWith("usr.")));
check(
  "local run excludes disabled challenges",
  localPool.every((e) => !CATALOG.slice(0, 120).some((d) => d.id === e.id)),
);
sandbox.localStorage.clear();

// Older seeds must keep reproducing their original card as the catalog grows.
const oldSeedStr = VF.seed.encodeSeed({
  fmt: VF.seed.SEED_FORMAT,
  catalog: 1,
  mode: 0,
  agentMode: 0,
  diffMask: 0b1111,
  tier: 1,
  opts: 0,
  nonce: 4242,
});
const beforeGrowth = buildTiles(oldSeedStr);
const originalCatalog = VF.catalog.CATALOG.slice();
VF.catalog.CATALOG.push(
  VF.catalog.finalize({
    id: "zzz.future.entry",
    kind: "objective",
    text: "a challenge added in a later release",
    difficulty: 2,
    since: 2,
  }),
);
const afterGrowth = buildTiles(oldSeedStr);
check(
  "an old seed still reproduces its card after the catalog grows",
  JSON.stringify(beforeGrowth) === JSON.stringify(afterGrowth),
);
VF.catalog.CATALOG.length = 0;
VF.catalog.CATALOG.push(...originalCatalog);

// agentMode 0 must exclude anything that depends on which agent you rolled.
const anyAgentPool = VF.pool.resolve({
  seed: VF.seed.decodeSeed(VF.seed.newSeed({ mode: "bingo", agentMode: 0 })),
}).pool;
check(
  "any-agent pool has no slot templates",
  anyAgentPool.every((e) => !e.slots.length && !e.agent && !e.role),
);

// Difficulty filtering.
const easyOnly = VF.pool.resolve({
  seed: VF.seed.decodeSeed(VF.seed.newSeed({ mode: "bingo", diffMask: 0b0001 })),
}).pool;
check("difficulty mask filters correctly", easyOnly.every((e) => e.difficulty === 1));
check("difficulty mask leaves a usable pool", easyOnly.length > 0);

// ------------------------------------------------------------------
section("ability capabilities");

const SLOTS = ["C", "Q", "E", "X"];

check(
  "every agent has a kind for all four slots",
  VF.cardsData.every((a) => a.abilityKinds && SLOTS.every((s) => a.abilityKinds[s])),
  VF.cardsData.filter((a) => !a.abilityKinds || !SLOTS.every((s) => a.abilityKinds[s]))
    .map((a) => a.title)
    .join(", "),
);
check(
  "every kind is one of the known set",
  VF.cardsData.every((a) => SLOTS.every((s) => VF.ABILITY_KINDS.includes(a.abilityKinds[s]))),
);

/** Maps a generated ability challenge id back to the agent + slot it names. */
function abilityRef(id) {
  const [, agentSlug, slot] = id.split("/");
  const agent = VF.cardsData.find((a) => VF.catalog.slugify(a.title) === agentSlug);
  return { agent, slot: (slot || "").toUpperCase() };
}

// The headline regression: a kill challenge must never name an ability that
// can't kill. This is what produced "Get a kill with your Healing Orb".
const killFamilies = ["obj.ability.kill-with/", "obj.ability.double-kill/", "obj.ability.combo/"];
const badKills = CATALOG.filter(
  (e) =>
    killFamilies.some((f) => e.id.startsWith(f)) &&
    !VF.canKill(abilityRef(e.id).agent, abilityRef(e.id).slot),
);
check(
  "no kill challenge names a non-lethal ability",
  badKills.length === 0,
  badKills.slice(0, 4).map((e) => `${e.id}: ${e.text}`).join(" | "),
);

const badAssists = CATALOG.filter(
  (e) =>
    (e.id.startsWith("obj.ability.affected/") ||
      e.id.startsWith("obj.ability.assist/") ||
      e.id.startsWith("obj.ability.entry/")) &&
    !VF.canAssist(abilityRef(e.id).agent, abilityRef(e.id).slot),
);
check("no assist challenge names an ability that can't set one up", badAssists.length === 0);

// Named regressions, straight from the report.
const mentions = (needle) =>
  CATALOG.filter((e) => e.id.startsWith("obj.ability.") && e.text.includes(needle));
for (const [name, why] of [
  ["Healing Orb", "Sage heal"],
  ["Resurrection", "Sage ult"],
  ["Barrier Orb", "Sage wall"],
  ["Nebula", "Astra smoke"],
  ["Cosmic Divide", "Astra wall"],
  ["Sky Smoke", "Brimstone smoke"],
  ["Dark Cover", "Omen smoke"],
]) {
  const kills = mentions(name).filter((e) => /\bkill\b/i.test(e.text) && !/enemy caught|revealed/.test(e.text));
  check(`no kill challenge for ${name} (${why})`, kills.length === 0, kills.map((e) => e.text).join(" | "));
}

// Sage and Astra have no lethal ability at all. The fix must not leave them
// with nothing — they should still get flavour from their control abilities.
for (const title of ["Sage", "Astra"]) {
  const agent = VF.AGENTS_BY_TITLE.get(title);
  check(`${title} genuinely has no lethal ability`, !SLOTS.some((s) => VF.canKill(agent, s)));
  const flavour = CATALOG.filter((e) => e.agent === title);
  check(`${title} still has agent challenges`, flavour.length >= 5, String(flavour.length));
}

check(
  "every agent gets at least a few ability challenges",
  VF.cardsData.every((a) => CATALOG.filter((e) => e.agent === a.title).length >= 5),
  VF.cardsData
    .filter((a) => CATALOG.filter((e) => e.agent === a.title).length < 5)
    .map((a) => a.title)
    .join(", "),
);

// The surviving {slot} templates must be usage-based only — nothing that
// assumes an ability can kill or assist, since those go on shared cards.
const slotTemplates = CATALOG.filter((e) => e.slots.length);
check(
  "surviving slot templates are all sharable",
  slotTemplates.every((e) => e.sharable),
);
check(
  "no surviving slot template promises a kill *with* the ability",
  !slotTemplates.some((e) => /kill (with|from a single) your \{/i.test(e.text)),
  slotTemplates.filter((e) => /kill (with|from a single) your \{/i.test(e.text)).map((e) => e.text).join(" | "),
);
check("enough universal slot templates for the agent quota", slotTemplates.length >= 10, String(slotTemplates.length));

// ------------------------------------------------------------------
section("icons");

check(
  "every agent has an icon and four ability icons",
  VF.cardsData.every(
    (a) => a.icon && ["C", "Q", "E", "X"].every((s) => a.abilityIcons[s]),
  ),
  VF.cardsData.filter((a) => !a.icon).map((a) => a.title).join(", "),
);
check("every weapon has an icon", VF.WEAPONS.every((w) => w.icon));

// A path that doesn't exist renders as a broken image and nothing else notices.
const iconPaths = new Set();
for (const a of VF.cardsData) {
  iconPaths.add(a.icon);
  for (const s of ["C", "Q", "E", "X"]) iconPaths.add(a.abilityIcons[s]);
}
for (const w of VF.WEAPONS) iconPaths.add(w.icon);

const missingFiles = [];
for (const p of iconPaths) {
  try {
    await access(join(ROOT, p.replace(/^\.\//, "")));
  } catch {
    missingFiles.push(p);
  }
}
check(
  `all ${iconPaths.size} icon files exist on disk`,
  missingFiles.length === 0,
  missingFiles.slice(0, 5).join(", "),
);

// Every entry must resolve to something, with and without a locked agent.
const skye = VF.AGENTS_BY_TITLE.get("Skye");
const jett = VF.AGENTS_BY_TITLE.get("Jett");
let unresolved = 0;
let badGlyph = 0;
for (const entry of VF.catalog.CATALOG) {
  for (const agent of [null, skye]) {
    const r = VF.icons.resolve(entry, agent);
    if (!r) {
      unresolved += 1;
      continue;
    }
    if (r.kind === "art" && !r.src) unresolved += 1;
    if (r.kind === "glyph" && !VF.icons.GLYPH_NAMES.includes(r.glyph)) badGlyph += 1;
  }
}
check("every catalog entry resolves to an icon", unresolved === 0, String(unresolved));
check("every glyph name is a real glyph", badGlyph === 0, String(badGlyph));

// Precedence.
const slotEntry = VF.catalog.CATALOG.find(
  (e) => e.slots.includes("E") && e.id.startsWith("obj.slot.hoard"),
);
check(
  "a slot template resolves to the locked agent's ability icon",
  VF.icons.resolve(slotEntry, skye).src === skye.abilityIcons.E,
);
check(
  "the same tile resolves differently for another agent",
  VF.icons.resolve(slotEntry, jett).src === jett.abilityIcons.E &&
    jett.abilityIcons.E !== skye.abilityIcons.E,
);
check(
  "a slot template with no agent falls back to a glyph",
  VF.icons.resolve(slotEntry, null).kind === "glyph",
);

const agentEntry = VF.catalog.CATALOG.find((e) => e.agent === "Jett");
check(
  "an agent-named entry resolves to that agent's portrait",
  VF.icons.resolve(agentEntry, skye).src === jett.icon,
  "agent art must win over the locked agent",
);

const weaponEntry = VF.catalog.CATALOG.find((e) => e.weapon === "Bucky");
check(
  "a weapon entry resolves to the weapon icon",
  VF.icons.resolve(weaponEntry, null).src ===
    VF.WEAPONS.find((w) => w.name === "Bucky").icon,
);

// Spot-check the glyph mapping reads sensibly.
const glyphOf = (id) => VF.icons.resolve(VF.catalog.get(id), null).glyph;
check("an ace is a skull", glyphOf("obj.gen.ace") === "skull", glyphOf("obj.gen.ace"));
check("a ninja defuse is a spike", glyphOf("obj.gen.ninja-defuse") === "spike", glyphOf("obj.gen.ninja-defuse"));
check("no-ADS is a crosshair", glyphOf("rule.play.no-ads") === "crosshair", glyphOf("rule.play.no-ads"));
check("walk-only is boots", glyphOf("rule.play.walk-only") === "boots", glyphOf("rule.play.walk-only"));
check("a meme rule is a chat bubble", glyphOf("meme.spray-on-kill") === "chat", glyphOf("meme.spray-on-kill"));
check("an economy rule is a coin", glyphOf("rule.play.no-shield") === "coin", glyphOf("rule.play.no-shield"));
check("a deathless half is a shield", glyphOf("obj.gen.deathless-half") === "shield", glyphOf("obj.gen.deathless-half"));
check("a 3K is a skull", glyphOf("obj.gen.3k") === "skull", glyphOf("obj.gen.3k"));
check("a flawless round is a shield", glyphOf("obj.gen.flawless") === "shield", glyphOf("obj.gen.flawless"));
check(
  "knife challenges get the knife art",
  VF.icons.resolve(VF.catalog.get("obj.gen.knife-duel"), null).src ===
    VF.WEAPONS.find((w) => w.name === "Knife").icon,
);

// The generic fallback should be rare — if it isn't, the mapping has drifted.
const starCount = VF.catalog.CATALOG.filter(
  (e) => VF.icons.resolve(e, null).glyph === "star",
).length;
check(
  "the star fallback stays uncommon",
  starCount < VF.catalog.CATALOG.length * 0.12,
  `${starCount} of ${VF.catalog.CATALOG.length}`,
);

// Art should be doing most of the work — if glyphs dominate, the mapping broke.
const artCount = VF.catalog.CATALOG.filter(
  (e) => VF.icons.resolve(e, skye).kind === "art",
).length;
check(
  "most challenges get real art when an agent is locked",
  artCount > VF.catalog.CATALOG.length * 0.5,
  `${artCount} of ${VF.catalog.CATALOG.length}`,
);

// ------------------------------------------------------------------
section("difficulty tiers");

function buildBingo(seedStr) {
  const seed = VF.seed.decodeSeed(seedStr);
  const { pool } = VF.pool.resolve({ seed });
  return VF.modes.bingo.build({ seedStr, seed, pool, agent: "Skye" });
}

/** Average count of each difficulty across many cards for one tier. */
function tierProfile(tier, { diffMask = 0b1111, samples = 300 } = {}) {
  const totals = [0, 0, 0, 0];
  let cards = 0;
  let maxFour = 0;
  let wrongSize = 0;
  let duplicates = 0;
  for (let i = 0; i < samples; i++) {
    const state = buildBingo(
      VF.seed.newSeed({ mode: "bingo", agentMode: 0, diffMask, tier, opts: 0 }),
    );
    if (!state) continue;
    cards += 1;
    if (state.tiles.length !== 25) wrongSize += 1;
    if (new Set(state.tiles).size !== state.tiles.length) duplicates += 1;
    let fours = 0;
    for (const id of state.tiles) {
      const d = VF.catalog.get(id).difficulty;
      totals[d - 1] += 1;
      if (d === 4) fours += 1;
    }
    maxFour = Math.max(maxFour, fours);
  }
  return { avg: totals.map((t) => t / cards), cards, maxFour, wrongSize, duplicates };
}

const easy = tierProfile(0);
const medium = tierProfile(1);
const hard = tierProfile(2);
const brutal = tierProfile(3);

for (const [name, p] of [["easy", easy], ["medium", medium], ["hard", hard], ["brutal", brutal]]) {
  check(`${name}: every card is 25 unique tiles`, p.wrongSize === 0 && p.duplicates === 0);
}

// The headline requirement: Easy tops out at a single 4-star.
check("easy never exceeds one 4-star tile", easy.maxFour <= 1, `saw ${easy.maxFour}`);
check("easy is mostly 1-2 star", easy.avg[0] + easy.avg[1] >= 18, easy.avg.join(", "));
check(
  "difficulty ramps monotonically across tiers",
  easy.avg[3] < medium.avg[3] && medium.avg[3] < hard.avg[3] && hard.avg[3] < brutal.avg[3],
  [easy.avg[3], medium.avg[3], hard.avg[3], brutal.avg[3]].map((n) => n.toFixed(1)).join(" -> "),
);
check("very hard is majority 4-star", brutal.avg[3] >= 12, brutal.avg[3].toFixed(1));
check("very hard has almost no 1-star", brutal.avg[0] <= 0.5, brutal.avg[0].toFixed(2));

// The tier and the star filter are independent: filtering 4-star out must still
// produce a full, valid Hard card rather than a short one.
const hardNoFours = tierProfile(2, { diffMask: 0b0111, samples: 120 });
check("hard with 4-star filtered out still fills the card", hardNoFours.wrongSize === 0);
check("hard with 4-star filtered out contains no 4-star", hardNoFours.maxFour === 0);
check(
  "the excluded weight is redistributed, not dropped",
  hardNoFours.avg[2] > hard.avg[2],
  `${hard.avg[2].toFixed(1)} -> ${hardNoFours.avg[2].toFixed(1)}`,
);

// Determinism has to hold for every tier x mask combination, since the quota
// branch changes how much rng each bucket consumes.
let tierDeterminismFailures = 0;
for (let tier = 0; tier < 4; tier++) {
  for (let mask = 1; mask <= 15; mask++) {
    for (const agentMode of [0, 1]) {
      const s = VF.seed.newSeed({ mode: "bingo", agentMode, diffMask: mask, tier, opts: 1 });
      const a = buildBingo(s);
      const b = buildBingo(s);
      if (JSON.stringify(a?.tiles) !== JSON.stringify(b?.tiles)) tierDeterminismFailures += 1;
    }
  }
}
check(
  "every tier x mask x agentMode combination is deterministic",
  tierDeterminismFailures === 0,
  `${tierDeterminismFailures} of 120 diverged`,
);

// allocateQuota is the part that has to sum exactly.
let quotaFailures = 0;
for (let i = 0; i < 5000; i++) {
  const available = [0, 1, 2, 3].map(() => Math.floor(Math.random() * 40));
  const count = 1 + Math.floor(Math.random() * 30);
  const weights = VF.runState.TIERS[Math.floor(Math.random() * 4)].weights;
  const quota = VF.runState.allocateQuota(available, count, weights);
  const sum = quota.reduce((a, b) => a + b, 0);
  const capacity = available.reduce((a, b) => a + b, 0);
  if (sum !== Math.min(count, capacity)) quotaFailures += 1;
  if (quota.some((q, j) => q < 0 || q > available[j])) quotaFailures += 1;
}
check("allocateQuota always sums exactly and respects capacity", quotaFailures === 0, String(quotaFailures));

// ------------------------------------------------------------------
section("agent-locked cards");

let noAgentTiles = 0;
let lockedSamples = 0;
for (let i = 0; i < 400; i++) {
  const state = buildBingo(VF.seed.newSeed({ mode: "bingo", agentMode: 1, diffMask: 0b1111, opts: 0 }));
  if (!state) continue;
  lockedSamples += 1;
  const slotTiles = state.tiles.filter((id) => VF.catalog.get(id)?.slots.length).length;
  if (slotTiles === 0) noAgentTiles += 1;
}
check("400 agent-locked cards built", lockedSamples === 400, String(lockedSamples));

// How much "lock to my agent" actually buys you, in both pool sizes.
function agentTileCount({ shared, agent = "Sova", samples = 100 }) {
  let total = 0;
  let cards = 0;
  for (let i = 0; i < samples; i++) {
    const seedStr = VF.seed.newSeed({ mode: "bingo", agentMode: 1, diffMask: 0b1111, tier: 1, opts: 0 });
    const seed = VF.seed.decodeSeed(seedStr);
    let pool;
    if (shared) {
      pool = VF.pool.resolve({ seed }).pool;
    } else {
      pool = VF.pool.forAgent(VF.pool.resolve({ seed: null, agentMode: 1, diffMask: 0b1111 }).pool, agent);
    }
    const state = VF.modes.bingo.build({ seedStr, seed, pool, agent });
    if (!state) continue;
    cards += 1;
    total += state.tiles.filter((id) => {
      const e = id === "FREE" ? null : VF.catalog.get(id);
      return e && (e.slots.length > 0 || e.agent);
    }).length;
  }
  return { avg: total / cards, cards };
}

const localAgent = agentTileCount({ shared: false });
const sharedAgent = agentTileCount({ shared: true });
check(
  "a local agent-locked card is around 40% agent tiles",
  localAgent.avg >= 9 && localAgent.avg <= 11,
  localAgent.avg.toFixed(1),
);
check(
  "a shared agent-locked card stays under its thin pool's budget",
  sharedAgent.avg >= 5 && sharedAgent.avg <= 7,
  sharedAgent.avg.toFixed(1),
);
check(
  "every agent-locked card carries agent-specific tiles",
  noAgentTiles === 0,
  `${noAgentTiles} cards had none`,
);

// The any-agent mode must be the opposite: never agent-dependent.
let anyAgentLeaks = 0;
for (let i = 0; i < 200; i++) {
  const state = buildBingo(VF.seed.newSeed({ mode: "bingo", agentMode: 0, diffMask: 0b1111, opts: 0 }));
  if (state && state.tiles.some((id) => VF.catalog.get(id)?.slots.length)) anyAgentLeaks += 1;
}
check("any-agent cards never contain slot templates", anyAgentLeaks === 0, String(anyAgentLeaks));

// Same seed, built twice, must be identical even through the quota branch.
const lockedSeed = VF.seed.newSeed({ mode: "bingo", agentMode: 1, diffMask: 0b1111, opts: 3 });
check(
  "agent-locked card generation is deterministic",
  JSON.stringify(buildBingo(lockedSeed).tiles) === JSON.stringify(buildBingo(lockedSeed).tiles),
);
check("agent-locked card has no duplicate tiles", new Set(buildBingo(lockedSeed).tiles).size === 25);

// ------------------------------------------------------------------
section("family diversity");

// The regression this whole section exists for: a real card came out holding
// six separate "get 4 kills" tiles. `obj.wpn.kills-in-round` is one generator
// with 57 entries, so a uniform draw over the pool genuinely produced that.

/** Worst family concentration seen across `samples` cards. */
function familyProfile({ agentMode = 0, opts = 0, samples = 200 } = {}) {
  let worst = 0;
  let worstFamily = null;
  let cards = 0;
  let short = 0;
  for (let i = 0; i < samples; i++) {
    const state = buildBingo(
      VF.seed.newSeed({ mode: "bingo", agentMode, diffMask: 0b1111, tier: 1, opts }),
    );
    if (!state) continue;
    cards += 1;
    if (state.tiles.length !== 25) short += 1;
    const counts = new Map();
    for (const id of state.tiles) {
      if (id === "FREE") continue;
      const family = VF.catalog.get(id).family;
      const n = (counts.get(family) ?? 0) + 1;
      counts.set(family, n);
      if (n > worst) {
        worst = n;
        worstFamily = family;
      }
    }
  }
  return { worst, worstFamily, cards, short };
}

const anyAgentFamilies = familyProfile({ agentMode: 0 });
const lockedFamilies = familyProfile({ agentMode: 1 });
check("200 any-agent cards built", anyAgentFamilies.cards === 200);
check("200 agent-locked cards built", lockedFamilies.cards === 200);
check("cards stay full under the family cap", anyAgentFamilies.short === 0 && lockedFamilies.short === 0);
check(
  "no any-agent card takes more than 2 tiles from one family",
  anyAgentFamilies.worst <= 2,
  `${anyAgentFamilies.worst}x ${anyAgentFamilies.worstFamily}`,
);
check(
  "no agent-locked card takes more than 2 tiles from one family",
  lockedFamilies.worst <= 2,
  `${lockedFamilies.worst}x ${lockedFamilies.worstFamily}`,
);

// The cap is a target, not a hard guarantee: when a bucket can't fill its quota
// under the cap, sampleDiverse spills rather than handing back a short card.
// That happens on local agent-locked cards, whose agent half is 10 tiles drawn
// from as few as 10 families — and it's harmless there, because three tiles
// from obj.agent.sage are three different Sage challenges. It must not run away
// though, so the local case gets its own bound.
let localWorst = 0;
let localWorstFamily = null;
const localBase = VF.pool.resolve({ seed: null, agentMode: 1, diffMask: 0b1111 }).pool;
for (const title of ["Sage", "Sova", "Astra", "Clove", "Yoru"]) {
  const agentPool = VF.pool.forAgent(localBase, title);
  for (let i = 0; i < 40; i++) {
    const seedStr = VF.seed.newSeed({ mode: "bingo", agentMode: 1, diffMask: 0b1111, tier: 1, opts: 1 });
    const seed = VF.seed.decodeSeed(seedStr);
    const state = VF.modes.bingo.build({ seedStr, seed, pool: agentPool, agent: title });
    const counts = new Map();
    for (const id of state.tiles) {
      if (id === "FREE") continue;
      const family = VF.catalog.get(id).family;
      const n = (counts.get(family) ?? 0) + 1;
      counts.set(family, n);
      if (n > localWorst) {
        localWorst = n;
        localWorstFamily = `${title}/${family}`;
      }
    }
  }
}
check(
  "the local agent-locked spill stays bounded at 3",
  localWorst <= 3,
  `${localWorst}x ${localWorstFamily}`,
);

// Every entry needs a family for the cap to mean anything.
check(
  "generated entries share a family, literals don't",
  VF.catalog.get("obj.wpn.kills-in-round/vandal/3").family === "obj.wpn.kills-in-round" &&
    VF.catalog.get("obj.gen.ace").family === "obj.gen.ace",
);

// The 4-kill tier is tombstoned, not deleted: gone from today's pool, still
// resolvable for a card shared before it was retired.
const fourKills = CATALOG.filter((e) => e.id.startsWith("obj.wpn.kills-in-round/") && e.id.endsWith("/4"));
check("all 19 four-kill entries still exist as tombstones", fourKills.length === 19, String(fourKills.length));
check("they are all marked removed in catalog 2", fourKills.every((e) => e.removedIn === 2));

const todaysPool = VF.pool.resolve({ seed: null, agentMode: 0, diffMask: 0b1111 }).pool;
check(
  "no four-kill entry survives into a local pool",
  todaysPool.every((e) => e.removedIn === null),
);

const catalogOnePool = VF.pool.resolve({
  seed: VF.seed.decodeSeed(
    VF.seed.encodeSeed({
      fmt: VF.seed.SEED_FORMAT,
      catalog: 1,
      mode: 0,
      agentMode: 0,
      diffMask: 0b1111,
      tier: 1,
      opts: 0,
      nonce: 11,
    }),
  ),
}).pool;
check(
  "a catalog-1 seed still sees all 19 of them",
  fourKills.every((e) => catalogOnePool.some((p) => p.id === e.id)),
);
check(
  "a catalog-1 seed sees nothing added in catalog 2",
  catalogOnePool.every((e) => e.since <= 1),
);

// ------------------------------------------------------------------
section("memes");

const memes = CATALOG.filter((e) => e.tags.includes("meme"));
check("there are meme objectives, not just meme rules", memes.some((e) => e.kind === "objective"));
check("meme rules are still there too", memes.some((e) => e.kind === "rule"));
check(
  "some meme objectives are sharable",
  memes.filter((e) => e.kind === "objective" && e.sharable).length >= 10,
);
check(
  "every agent has a meme",
  VF.cardsData.every((a) => CATALOG.some((e) => e.agent === a.title && e.tags.includes("meme"))),
  VF.cardsData
    .filter((a) => !CATALOG.some((e) => e.agent === a.title && e.tags.includes("meme")))
    .map((a) => a.title)
    .join(", "),
);
check(
  "agent memes are never sharable",
  memes.every((e) => !e.agent || !e.sharable),
);

// Memes are meant to be jokes you play, not typing homework. Everything that
// asked you to use the chat box or the mic was retired in catalog 2.
const liveMemes = memes.filter((e) => e.removedIn === null);
const chatty = liveMemes.filter((e) =>
  /all-chat|in chat|type |say |out loud|in voice|announce|callout|compliment|praise|narrate/i.test(e.text),
);
check(
  "no live meme asks you to type or talk",
  chatty.length === 0,
  chatty.map((e) => e.text).join(" | "),
);
check("plenty of memes survived the cull", liveMemes.length >= 40, String(liveMemes.length));

// Retired in catalog 2 for being a scoreboard, not a challenge.
check("top frag is tombstoned", VF.catalog.get("obj.gen.top-frag").removedIn === 2);

// "Use your C every round of a half" was an objective you couldn't track and
// couldn't fail cleanly. Same idea, reissued as a rule.
check(
  "the every-round objective is retired",
  CATALOG.filter((e) => e.id.startsWith("obj.slot.every-round/")).every((e) => e.removedIn === 2),
);
const everyRoundRules = CATALOG.filter((e) => e.id.startsWith("rule.slot.every-round/"));
check("it came back as a rule", everyRoundRules.length === 3 && everyRoundRules.every((e) => e.kind === "rule"));
check("and it still renders the agent's ability name",
  VF.catalog.renderChallengeText(everyRoundRules[0], VF.AGENTS_BY_TITLE.get("Skye")).includes("Regrowth"),
  VF.catalog.renderChallengeText(everyRoundRules[0], VF.AGENTS_BY_TITLE.get("Skye")),
);

const noMemePool = VF.pool.resolve({
  seed: VF.seed.decodeSeed(
    VF.seed.newSeed({ mode: "bingo", agentMode: 0, opts: VF.seed.OPT_NO_MEME }),
  ),
}).pool;
check("OPT_NO_MEME empties the memes out of the pool", noMemePool.every((e) => !e.tags.includes("meme")));
check("OPT_NO_MEME leaves a usable pool", noMemePool.filter((e) => e.kind === "objective").length >= 25);

/** How many of `samples` cards carried at least one meme tile. */
function memeCardRate(opts) {
  let withMemes = 0;
  for (let i = 0; i < 200; i++) {
    const state = buildBingo(VF.seed.newSeed({ mode: "bingo", agentMode: 0, diffMask: 0b1111, tier: 1, opts }));
    if (state && state.tiles.some((id) => id !== "FREE" && VF.catalog.get(id).tags.includes("meme"))) {
      withMemes += 1;
    }
  }
  return withMemes;
}
check("memes reach the board by default", memeCardRate(0) > 0);
check("no meme reaches the board with the toggle on", memeCardRate(VF.seed.OPT_NO_MEME) === 0);

const memeSeed = VF.seed.newSeed({
  mode: "bingo",
  agentMode: 1,
  diffMask: 0b1111,
  opts: VF.seed.OPT_FREE_CENTER | VF.seed.OPT_NO_MEME,
});
check(
  "the no-meme option is deterministic like every other seed field",
  JSON.stringify(buildBingo(memeSeed).tiles) === JSON.stringify(buildBingo(memeSeed).tiles),
);

// ------------------------------------------------------------------
section("bingo line masks");

const SIZE = 5;
const bit = (r, c) => 1 << (r * SIZE + c);
const LINE_MASKS = (() => {
  const idx = [0, 1, 2, 3, 4];
  const masks = [];
  for (const r of idx) masks.push(idx.reduce((acc, c) => acc | bit(r, c), 0));
  for (const c of idx) masks.push(idx.reduce((acc, r) => acc | bit(r, c), 0));
  masks.push(idx.reduce((acc, i) => acc | bit(i, i), 0));
  masks.push(idx.reduce((acc, i) => acc | bit(i, SIZE - 1 - i), 0));
  return masks;
})();
check("12 lines", LINE_MASKS.length === 12);
check("every line covers 5 cells", LINE_MASKS.every((m) => popcount(m) === 5));
check("all 25 bits fit in a safe int", (1 << 25) - 1 === 33554431);

function popcount(n) {
  let count = 0;
  while (n) {
    count += n & 1;
    n >>>= 1;
  }
  return count;
}

// ------------------------------------------------------------------
console.log(
  `\n${checks - failures}/${checks} checks passed` + (failures ? ` — ${failures} FAILED` : ""),
);
console.log(
  `catalog: ${CATALOG.length} entries, ${sharable.length} sharable, ` +
    `${CATALOG.filter((e) => e.kind === "objective").length} objectives, ` +
    `${CATALOG.filter((e) => e.kind === "rule").length} rules`,
);
process.exit(failures ? 1 : 0);
