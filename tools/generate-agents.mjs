#!/usr/bin/env node
/**
 * Regenerates assets/js/data/agents.js and assets/js/data/weapons.js from
 * valorant-api.com.
 *
 * DEV-ONLY. This never ships to the browser — the site does no runtime fetch so
 * it keeps working offline and off plain static hosting. Run it by hand when
 * Riot adds an agent or reworks an ability:
 *
 *     node tools/generate-agents.mjs
 *
 * It also downloads the icon art into assets/img/icons/ and commits it, for the
 * same reason: nothing may be fetched at runtime. Existing files are left alone
 * unless you pass --force, so a re-run after a Riot patch costs a handful of
 * requests rather than ~170.
 *
 * Then commit the generated files. Node 18+ (global fetch), zero deps.
 *
 * The script refuses to write if anything it depends on has drifted — see the
 * assertions below. `title` in particular is the primary key for the
 * `valorant.fyi/included-agents` localStorage value, so a silent rename would
 * wipe people's saved agent pool.
 */

import { writeFile, access, mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const FORCE = process.argv.includes("--force");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://valorant-api.com/v1";

/**
 * The agent roster as it exists in the committed data today. The generated
 * roster must match this exactly; a mismatch means Riot added/renamed an agent
 * and a human needs to decide what to do (add the .webp, update this list).
 */
const EXPECTED_TITLES = [
  "Astra", "Breach", "Brimstone", "Chamber", "Clove", "Cypher", "Deadlock",
  "Fade", "Gekko", "Harbor", "Iso", "Jett", "KAY/O", "Killjoy", "Miks",
  "Neon", "Omen", "Phoenix", "Raze", "Reyna", "Sage", "Skye", "Sova", "Tejo",
  "Veto", "Viper", "Vyse", "Waylay", "Yoru",
];

/** valorant-api ability slot -> the key the player actually presses. */
const SLOT_BY_API = {
  Grenade: "C",
  Ability1: "Q",
  Ability2: "E", // signature
  Ultimate: "X",
  Passive: "passive",
};

/**
 * Ability names that read badly inside challenge text. The API returns Astra's
 * E as "Nebula  / Dissipate" and her X as "Astral Form / Cosmic Divide" (both
 * forms of one ability), which renders as
 * "Get a kill with your Nebula  / Dissipate". Keep the name players actually use.
 */
const ABILITY_OVERRIDES = {
  Astra: { E: "Nebula", X: "Cosmic Divide" },
};

/**
 * What each ability can actually do, so the catalog stops handing out things
 * like "get a kill with your Healing Orb".
 *
 * Riot's API doesn't expose this — the descriptions are prose — so it's
 * hand-authored, one kind per agent per slot:
 *
 *   lethal    can secure a kill on its own (molly, turret, damaging ult)
 *   control   debuffs enemies but can't kill (flash, concuss, slow, suppress)
 *   recon     reveals
 *   smoke / wall / mobility / heal / buff   none of the above
 *
 * Derived downstream: canKill = lethal; canAssist = lethal | control | recon.
 *
 * Note Sage and Astra have no lethal ability at all — which is exactly why a
 * "kill with your {E}" template can never be valid for every agent.
 */
const ABILITY_KINDS = {
  Astra:     { C: "control",  Q: "control",  E: "smoke",    X: "wall" },
  Breach:    { C: "lethal",   Q: "control",  E: "control",  X: "control" },
  Brimstone: { C: "buff",     Q: "lethal",   E: "smoke",    X: "lethal" },
  Chamber:   { C: "control",  Q: "lethal",   E: "mobility", X: "lethal" },
  Clove:     { C: "buff",     Q: "control",  E: "smoke",    X: "buff" },
  Cypher:    { C: "control",  Q: "smoke",    E: "recon",    X: "recon" },
  Deadlock:  { C: "wall",     Q: "control",  E: "control",  X: "lethal" },
  Fade:      { C: "control",  Q: "control",  E: "recon",    X: "control" },
  Gekko:     { C: "lethal",   Q: "control",  E: "control",  X: "lethal" },
  Harbor:    { C: "control",  Q: "wall",     E: "wall",     X: "control" },
  Iso:       { C: "wall",     Q: "control",  E: "buff",     X: "buff" },
  Jett:      { C: "smoke",    Q: "mobility", E: "mobility", X: "lethal" },
  "KAY/O":   { C: "lethal",   Q: "control",  E: "control",  X: "control" },
  Killjoy:   { C: "lethal",   Q: "control",  E: "lethal",   X: "control" },
  Miks:      { C: "lethal",   Q: "buff",     E: "control",  X: "lethal" },
  Neon:      { C: "wall",     Q: "control",  E: "mobility", X: "lethal" },
  Omen:      { C: "mobility", Q: "control",  E: "smoke",    X: "mobility" },
  Phoenix:   { C: "wall",     Q: "lethal",   E: "control",  X: "buff" },
  Raze:      { C: "lethal",   Q: "lethal",   E: "lethal",   X: "lethal" },
  Reyna:     { C: "control",  Q: "heal",     E: "mobility", X: "buff" },
  Sage:      { C: "wall",     Q: "control",  E: "heal",     X: "heal" },
  Skye:      { C: "heal",     Q: "lethal",   E: "control",  X: "control" },
  Sova:      { C: "lethal",   Q: "lethal",   E: "recon",    X: "lethal" },
  Tejo:      { C: "control",  Q: "control",  E: "lethal",   X: "lethal" },
  Veto:      { C: "lethal",   Q: "control",  E: "control",  X: "buff" },
  Viper:     { C: "lethal",   Q: "smoke",    E: "wall",     X: "smoke" },
  Vyse:      { C: "lethal",   Q: "wall",     E: "control",  X: "control" },
  Waylay:    { C: "control",  Q: "mobility", E: "mobility", X: "control" },
  Yoru:      { C: "control",  Q: "control",  E: "mobility", X: "buff" },
};

const ABILITY_KIND_NAMES = [
  "lethal", "control", "recon", "smoke", "wall", "mobility", "heal", "buff",
];

const WEAPON_CATEGORIES = {
  Pistols: "Sidearm",
  SMGs: "SMG",
  Shotguns: "Shotgun",
  Rifles: "Rifle",
  "Sniper Rifles": "Sniper",
  "Heavy Weapons": "Heavy",
};

/** Matches the image filename convention: KAY/O -> kayo. */
const slug = (title) => title.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The API has stray double spaces in a few names. */
const tidy = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

const problems = [];
const check = (condition, message) => {
  if (!condition) problems.push(message);
};

async function getJson(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${res.statusText}`);
  const body = await res.json();
  if (!Array.isArray(body.data)) throw new Error(`GET ${path} -> unexpected shape`);
  return body.data;
}

async function exists(relPath) {
  try {
    await access(join(ROOT, relPath));
    return true;
  } catch {
    return false;
  }
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

let downloaded = 0;
let reused = 0;

/**
 * Fetches an icon to `relPath` and returns the web path for the generated data.
 *
 * A half-written or HTML-error-page "icon" renders as a permanently broken image
 * that nothing else would catch, so the bytes are checked for the PNG signature
 * before anything touches the disk, and a failure is collected like the roster
 * assertions rather than silently skipped.
 */
async function fetchIcon(url, relPath) {
  const webPath = `./${relPath.replace(/\\/g, "/")}`;
  if (!url) {
    problems.push(`No icon URL for ${relPath}`);
    return null;
  }

  if (!FORCE && (await exists(relPath))) {
    const { size } = await stat(join(ROOT, relPath));
    if (size > 0) {
      reused += 1;
      return webPath;
    }
  }

  const res = await fetch(url);
  if (!res.ok) {
    problems.push(`GET ${url} -> ${res.status} for ${relPath}`);
    return null;
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 100 || !bytes.subarray(0, 4).equals(PNG_MAGIC)) {
    problems.push(`Not a PNG (${bytes.length} bytes): ${url}`);
    return null;
  }

  await mkdir(dirname(join(ROOT, relPath)), { recursive: true });
  await writeFile(join(ROOT, relPath), bytes);
  downloaded += 1;
  return webPath;
}

/** Downloads run in small batches — 170 parallel requests gets us rate-limited. */
async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

function buildAgents(raw) {
  const agents = raw
    .map((a) => {
      const title = tidy(a.displayName);
      const abilities = { C: null, Q: null, E: null, X: null, passive: null };
      const abilityUrls = {};
      for (const ability of a.abilities ?? []) {
        const slot = SLOT_BY_API[ability.slot];
        if (!slot) continue;
        abilities[slot] = tidy(ability.displayName) || null;
        abilityUrls[slot] = ability.displayIcon || null;
      }
      Object.assign(abilities, ABILITY_OVERRIDES[title] ?? {});
      return {
        title,
        imgSrc: `./assets/img/agents-full/${slug(title)}.webp`,
        imgAlt: title,
        role: a.role?.displayName?.trim() ?? null,
        abilities,
        icon: null,
        abilityIcons: { C: null, Q: null, E: null, X: null },
        abilityKinds: ABILITY_KINDS[title] ?? null,
        // Stripped before rendering — only used by the icon download pass.
        urls: { agent: a.killfeedPortrait, abilities: abilityUrls },
      };
    })
    .sort((x, y) => x.title.localeCompare(y.title, "en"));

  for (const a of agents) {
    // Slot templates ("get a kill with your {E}") assume every agent has all
    // four bindable slots. If that ever stops being true the templates need a
    // per-agent eligibility check, so fail loudly rather than render "undefined".
    for (const slot of ["C", "Q", "E", "X"]) {
      check(a.abilities[slot], `${a.title} is missing a ${slot} ability`);
      // Without a kind the catalog can't tell whether an ability can get a kill,
      // so a new agent must be classified by hand before anything ships.
      const kind = a.abilityKinds && a.abilityKinds[slot];
      check(kind, `${a.title} ${slot} (${a.abilities[slot]}) has no entry in ABILITY_KINDS`);
      check(
        !kind || ABILITY_KIND_NAMES.includes(kind),
        `${a.title} ${slot} has unknown ability kind: ${kind}`,
      );
    }
    check(a.role, `${a.title} has no role`);
  }

  return agents;
}

/**
 * Downloads every icon and swaps the URLs on each record for local paths.
 * Mutates in place, then deletes the `urls` scratch fields.
 */
async function attachIcons(agents, weapons) {
  const jobs = [];

  for (const agent of agents) {
    const base = slug(agent.title);
    jobs.push(async () => {
      agent.icon = await fetchIcon(agent.urls.agent, `assets/img/icons/agents/${base}.png`);
    });
    for (const slot of ["C", "Q", "E", "X"]) {
      jobs.push(async () => {
        agent.abilityIcons[slot] = await fetchIcon(
          agent.urls.abilities[slot],
          `assets/img/icons/abilities/${base}-${slot.toLowerCase()}.png`,
        );
      });
    }
  }

  for (const weapon of weapons) {
    jobs.push(async () => {
      weapon.icon = await fetchIcon(weapon.url, `assets/img/icons/weapons/${slug(weapon.name)}.png`);
    });
  }

  await inBatches(jobs, 8, (job) => job());

  for (const agent of agents) delete agent.urls;
  for (const weapon of weapons) delete weapon.url;
}

function buildWeapons(raw) {
  const weapons = [];
  for (const w of raw) {
    const name = w.displayName.trim();
    if (name === "Melee") {
      weapons.push({ name: "Knife", cat: "Melee", cost: 0, icon: null, url: w.killStreamIcon });
      continue;
    }
    const cat = WEAPON_CATEGORIES[w.shopData?.category];
    if (!cat) {
      problems.push(`Unmapped weapon category for ${name}: ${w.shopData?.category}`);
      continue;
    }
    // killStreamIcon is the small killfeed silhouette (~4 KB); displayIcon is
    // the full shop render at ~30 KB, far too heavy for a tile watermark.
    weapons.push({ name, cat, cost: w.shopData.cost ?? 0, icon: null, url: w.killStreamIcon });
  }
  weapons.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, "en"));
  check(weapons.some((w) => w.cat === "Melee"), "No melee weapon found");
  return weapons;
}

const banner = (file) => `// ${file} — GENERATED by tools/generate-agents.mjs. Do not hand-edit.
// Source: valorant-api.com. Regenerate with: node tools/generate-agents.mjs
`;

function renderAgents(agents) {
  const entries = agents
    .map((a) => {
      const ab = a.abilities;
      const ic = a.abilityIcons;
      const abilities =
        `{ C: ${j(ab.C)}, Q: ${j(ab.Q)}, E: ${j(ab.E)}, ` +
        `X: ${j(ab.X)}, passive: ${j(ab.passive)} }`;
      const abilityIcons =
        `{ C: ${j(ic.C)}, Q: ${j(ic.Q)}, E: ${j(ic.E)}, X: ${j(ic.X)} }`;
      const k = a.abilityKinds;
      const abilityKinds =
        `{ C: ${j(k.C)}, Q: ${j(k.Q)}, E: ${j(k.E)}, X: ${j(k.X)} }`;
      return `    {
      title: ${j(a.title)},
      imgSrc: ${j(a.imgSrc)},
      imgAlt: ${j(a.imgAlt)},
      role: ${j(a.role)},
      icon: ${j(a.icon)},
      abilities: ${abilities},
      abilityIcons: ${abilityIcons},
      abilityKinds: ${abilityKinds},
    },`;
    })
    .join("\n");

  const roles = [...new Set(agents.map((a) => a.role))].sort();

  return `${banner("agents.js")}
(function (VF) {
  "use strict";

  // \`title\` is the primary key for the valorant.fyi/included-agents localStorage
  // value, the selection-grid label and the background codename feed. It must
  // never change for an existing agent.
  VF.cardsData = [
${entries}
  ];

  VF.AGENTS_BY_TITLE = new Map(VF.cardsData.map((a) => [a.title, a]));
  VF.ROLES = ${JSON.stringify(roles)};
  VF.ABILITY_SLOTS = ["C", "Q", "E", "X"];
  VF.ABILITY_KINDS = ${JSON.stringify(ABILITY_KIND_NAMES)};

  /** Can this ability secure a kill by itself? */
  VF.canKill = (agent, slot) => agent.abilityKinds[slot] === "lethal";

  /** Can it at least set up a kill someone else finishes? */
  VF.canAssist = (agent, slot) =>
    ["lethal", "control", "recon"].includes(agent.abilityKinds[slot]);
})(window.VF);
`;
}

function renderWeapons(weapons) {
  const entries = weapons
    .map(
      (w) =>
        `    { name: ${j(w.name)}, cat: ${j(w.cat)}, cost: ${w.cost}, icon: ${j(w.icon)} },`,
    )
    .join("\n");
  const cats = [...new Set(weapons.map((w) => w.cat))];

  return `${banner("weapons.js")}
(function (VF) {
  "use strict";

  VF.WEAPONS = [
${entries}
  ];

  VF.WEAPON_CATEGORIES = ${JSON.stringify(cats)};
  VF.weaponsByCat = (cat) => VF.WEAPONS.filter((w) => w.cat === cat);
})(window.VF);
`;
}

const j = (v) => JSON.stringify(v);

async function main() {
  const [rawAgents, rawWeapons] = await Promise.all([
    getJson("/agents?isPlayableCharacter=true&language=en-US"),
    getJson("/weapons?language=en-US"),
  ]);

  const agents = buildAgents(rawAgents);
  const weapons = buildWeapons(rawWeapons);

  await attachIcons(agents, weapons);

  const titles = agents.map((a) => a.title);
  const expected = new Set(EXPECTED_TITLES);
  for (const t of titles) {
    if (!expected.has(t)) problems.push(`New agent from the API: ${t} (add art, then add to EXPECTED_TITLES)`);
  }
  for (const t of EXPECTED_TITLES) {
    if (!titles.includes(t)) problems.push(`Agent missing from the API: ${t}`);
  }

  for (const a of agents) {
    if (!(await exists(a.imgSrc.replace("./", "")))) {
      problems.push(`Missing portrait: ${a.imgSrc}`);
    }
  }

  if (problems.length) {
    console.error("Refusing to write — roster drifted:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  await writeFile(join(ROOT, "assets/js/data/agents.js"), renderAgents(agents), "utf8");
  await writeFile(join(ROOT, "assets/js/data/weapons.js"), renderWeapons(weapons), "utf8");

  console.log(
    `Wrote ${agents.length} agents and ${weapons.length} weapons. ` +
      `Icons: ${downloaded} downloaded, ${reused} already present.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
