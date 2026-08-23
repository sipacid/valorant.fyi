// catalog.js — every challenge the site can hand out.
//
// ============================ INVARIANTS ============================
// A shared card is regenerated from a seed, not transmitted. That only works if
// this file behaves like an append-only log:
//
//   1. NEVER change the `text` of a shipped entry. Tombstone it with
//      `removedIn` and add a new id instead. Editing text in place silently
//      rewrites every card anyone has ever shared.
//   2. NEVER reuse an id. Ids key the enabled/disabled set and bingo marks.
//   3. Append only, and bump VF.seed.CATALOG_VERSION in the same commit,
//      setting `since` on the new entries.
//   4. expand() sorts by id. Nothing may depend on insertion order.
//
// Run VF.catalog.assertIntegrity() in the console after editing.
// ====================================================================

(function (VF) {
  "use strict";

  const DIFFICULTY_POINTS = { 1: 10, 2: 25, 3: 50, 4: 100 };

  const SLOT_RE = /\{(C|Q|E|X|passive)\}/g;

  // Used when no agent is locked in, so the text still reads as a sentence.
  const GENERIC_SLOT_LABEL = {
    C: "C ability",
    Q: "Q ability",
    E: "signature ability",
    X: "Ultimate",
    passive: "passive",
  };

  const CATEGORY_LABEL = {
    Sidearm: "Sidearms",
    SMG: "SMGs",
    Shotgun: "Shotguns",
    Rifle: "Rifles",
    Sniper: "Snipers",
    Heavy: "Heavy weapons",
  };

  const slugify = (s) =>
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  /**
   * Fills {C}/{Q}/{E}/{X} with the locked agent's ability names.
   *
   * This is what lets a shared card carry agent-flavoured tiles: everyone draws
   * the same tile id, but tile 7 reads "...with your Trailblazer" for a Skye and
   * "...with your Updraft" for a Jett.
   *
   * @param {Object} challenge
   * @param {Object|null} agent entry from VF.cardsData
   */
  function renderChallengeText(challenge, agent) {
    if (!challenge) return "";
    if (!challenge.slots || !challenge.slots.length) return challenge.text;
    return challenge.text.replace(
      SLOT_RE,
      (_, slot) => (agent && agent.abilities && agent.abilities[slot]) || GENERIC_SLOT_LABEL[slot],
    );
  }

  // ------------------------------------------------------------------
  // Generators — a little data yields a lot of challenges.
  // ------------------------------------------------------------------

  const guns = () => VF.WEAPONS.filter((w) => w.cat !== "Melee");

  const GENERATORS = [
    {
      family: "obj.wpn.kills-in-round",
      kind: "objective",
      scope: "round",
      tags: ["weapon", "gunplay"],
      params: { weapon: guns(), n: [2, 3, 4] },
      id: ({ weapon, n }) => `${slugify(weapon.name)}/${n}`,
      text: ({ weapon, n }) => `Get ${n} ${weapon.name} kills in a single round`,
      difficulty: ({ weapon, n }) =>
        clampDifficulty(n - 1 + (weapon.cat === "Sniper" || weapon.cat === "Shotgun" ? 1 : 0)),
      weapon: ({ weapon }) => weapon.name,
    },
    {
      family: "obj.wpn.first-blood",
      kind: "objective",
      scope: "match",
      tags: ["weapon", "gunplay"],
      params: { weapon: guns() },
      id: ({ weapon }) => slugify(weapon.name),
      text: ({ weapon }) => `Get a first blood with the ${weapon.name}`,
      difficulty: ({ weapon }) => (weapon.cost >= 2400 ? 3 : 2),
      weapon: ({ weapon }) => weapon.name,
    },
    {
      family: "rule.wpn.only",
      kind: "rule",
      scope: "match",
      tags: ["weapon", "handicap"],
      conflictGroup: "primary-weapon",
      params: { weapon: VF.WEAPONS.filter((w) => w.cat !== "Melee" && w.cost <= 1600) },
      id: ({ weapon }) => slugify(weapon.name),
      text: ({ weapon }) => `${weapon.name} only — buy nothing else all match`,
      difficulty: ({ weapon }) => (weapon.cat === "Sidearm" ? 4 : 3),
      weapon: ({ weapon }) => weapon.name,
    },
    {
      family: "rule.wpn.cat-only",
      kind: "rule",
      scope: "match",
      tags: ["weapon", "handicap"],
      conflictGroup: "primary-weapon",
      params: { cat: Object.keys(CATEGORY_LABEL) },
      id: ({ cat }) => slugify(cat),
      text: ({ cat }) => `${CATEGORY_LABEL[cat]} only — no other weapon class`,
      difficulty: ({ cat }) => (cat === "Rifle" ? 1 : cat === "Sidearm" ? 4 : 3),
    },
    // ---- Universal slot templates ----
    //
    // These are the only `{slot}` templates left, and they're all *usage*-based:
    // true of any ability whatever it does. Anything phrased around getting a
    // kill or an assist moved to the per-agent generator below, because whether
    // an ability can do that depends on the agent — Sage's Healing Orb can't.
    //
    // That matters beyond correctness: a shared card is rebuilt from a seed, so
    // tile eligibility can't depend on which agent you rolled, and these are the
    // only agent-flavoured tiles that can safely appear on one.
    {
      family: "obj.slot.every-round",
      kind: "objective",
      scope: "match",
      tags: ["utility"],
      params: { slot: ["C", "Q"] },
      id: ({ slot }) => slot.toLowerCase(),
      text: ({ slot }) => `Use your {${slot}} in every round of a half`,
      slots: ({ slot }) => [slot],
      difficulty: () => 2,
    },
    {
      family: "obj.slot.early",
      kind: "objective",
      scope: "round",
      tags: ["utility", "tempo"],
      params: { slot: ["X"] },
      id: ({ slot }) => slot.toLowerCase(),
      text: ({ slot }) => `Use your {${slot}} before the round timer hits 1:00`,
      slots: ({ slot }) => [slot],
      difficulty: () => 2,
    },
    {
      family: "obj.slot.only",
      kind: "objective",
      scope: "round",
      tags: ["utility", "handicap"],
      params: { slot: ["C", "Q", "E"] },
      id: ({ slot }) => slot.toLowerCase(),
      text: ({ slot }) => `Win a round where the only ability you used was your {${slot}}`,
      slots: ({ slot }) => [slot],
      difficulty: () => 3,
    },
    {
      family: "obj.slot.round-win",
      kind: "objective",
      scope: "round",
      tags: ["utility"],
      params: { slot: ["E", "X"] },
      id: ({ slot }) => slot.toLowerCase(),
      text: ({ slot }) => `Use your {${slot}} and go on to win that round`,
      slots: ({ slot }) => [slot],
      difficulty: ({ slot }) => (slot === "X" ? 2 : 1),
    },
    {
      family: "obj.slot.hoard",
      kind: "objective",
      scope: "round",
      tags: ["utility", "handicap"],
      params: { slot: ["E", "X"] },
      id: ({ slot }) => slot.toLowerCase(),
      text: ({ slot }) => `Win a round with your {${slot}} still unused`,
      slots: ({ slot }) => [slot],
      difficulty: () => 2,
    },
    {
      family: "obj.slot.dry",
      kind: "objective",
      scope: "round",
      tags: ["utility", "handicap"],
      params: { slot: ["C", "Q", "E"] },
      id: ({ slot }) => slot.toLowerCase(),
      text: ({ slot }) => `Get a kill in a round where you never used your {${slot}}`,
      slots: ({ slot }) => [slot],
      difficulty: () => 2,
    },
  ];

  const clampDifficulty = (n) => Math.max(1, Math.min(4, Math.round(n)));

  // ------------------------------------------------------------------
  // Hand-written generic entries. These carry the feature — the generators
  // give volume, but "3 Frenzy kills in a round" is not why anyone plays.
  // ------------------------------------------------------------------

  const LITERALS = [
    // --- Match-long handicap rules ---
    r("rule.play.no-ads", "Never ADS or scope in — hipfire only, all match", 4, "aim"),
    r("rule.play.tap-only", "Tap fire only — no sprays longer than 3 bullets", 3, "aim"),
    r("rule.play.spray-only", "Never tap or burst — hold the trigger every time", 3, "aim"),
    r("rule.play.body-aim", "Aim at body level only — no headshot crosshair placement", 3, "aim"),
    r("rule.play.walk-only", "Walk everywhere — never run", 4, "movement"),
    r("rule.play.no-crouch", "Never crouch, not even while shooting", 2, "movement"),
    r("rule.play.crouch-to-shoot", "Only shoot while crouching", 3, "movement"),
    r("rule.play.no-jump", "Never jump", 2, "movement"),
    r("rule.play.knife-out", "Knife out at all times unless you are actually shooting", 2, "movement"),
    r("rule.play.no-util", "Buy no abilities all match", 3, "utility"),
    r("rule.play.full-util", "Buy every ability, every round you can afford it", 1, "utility"),
    r("rule.play.util-second-half", "No abilities at all until the second half", 3, "utility"),
    r("rule.play.no-shield", "Never buy shields", 3, "economy"),
    r("rule.play.eco-cap", "Never spend more than 2000 credits in a round", 3, "economy"),
    r("rule.play.always-full-buy", "Full buy every round, even when you should save", 2, "economy"),
    r("rule.play.buy-for-team", "Buy a gun for a teammate every round you can afford it", 2, "economy"),
    r("rule.play.no-comms", "No voice comms all match — pings only", 2, "comms"),
    r("rule.play.always-call", "Call out every single enemy you see, every time", 1, "comms"),
    r("rule.play.first-out", "Be the first player out of spawn every round", 2, "tempo"),
    r("rule.play.last-out", "Be the last player out of spawn every round", 2, "tempo"),
    r("rule.play.same-site", "Commit to the same site every single round", 2, "site"),
    r("rule.play.always-spike", "Carry the spike every attacking round", 1, "site"),
    r("rule.play.default-plant", "Only ever plant at the default plant spot", 1, "site"),
    r("rule.play.no-reload", "Never manually reload — only reload when you're empty", 3, "aim"),
    r("rule.play.left-hand", "Left-handed viewmodel for the whole match", 1, null),
    r("rule.play.ground-guns", "Only use guns you picked up off the ground", 4, "primary-weapon"),
    r("rule.play.no-vandal-phantom", "No Vandal and no Phantom — pick something else", 2, "primary-weapon"),
    r("rule.play.no-minimap", "Never look at the minimap", 4, null),
    r("rule.play.silent-plant", "Never plant unless a teammate is watching your back", 2, "site"),
    r("rule.play.entry-every-round", "Be the first one onto the site every attacking round", 3, "tempo"),

    // --- Objectives: the fun stuff ---
    o("obj.gen.ace", "Ace a round", 4, "match"),
    o("obj.gen.4k", "Get a 4K in a single round", 4, "round"),
    o("obj.gen.3k", "Get a 3K in a single round", 3, "round"),
    o("obj.gen.2k", "Get a 2K in a single round", 1, "round"),
    o("obj.gen.clutch-1v3", "Win a 1v3", 4, "match"),
    o("obj.gen.clutch-1v2", "Win a 1v2", 3, "match"),
    o("obj.gen.clutch-1v1", "Win a 1v1 clutch", 2, "match"),
    o("obj.gen.knife-kill", "Get a knife kill", 3, "match", { weapon: "Knife" }),
    o("obj.gen.knife-duel", "Win a knife-only duel against someone who has a gun", 4, "match", { weapon: "Knife" }),
    o("obj.gen.collateral", "Get a collateral — two kills with one bullet", 4, "match"),
    o("obj.gen.wallbang", "Get a wallbang kill", 3, "match"),
    o("obj.gen.noscope", "Get a no-scope kill with a sniper", 4, "match"),
    o("obj.gen.headshot-round", "Win a round where every one of your kills was a headshot", 3, "round"),
    o("obj.gen.blind-kill", "Get a kill while you are blinded", 3, "match"),
    o("obj.gen.air-kill", "Get a kill while airborne", 2, "match"),
    o("obj.gen.first-blood", "Get first blood", 2, "match"),
    o("obj.gen.trade", "Trade a teammate's death within 3 seconds", 1, "match"),
    o("obj.gen.assist-3", "Get 3 assists in a single round", 3, "round"),
    o("obj.gen.untouched", "Win a round without taking a single point of damage", 2, "round"),
    o("obj.gen.no-shot-round", "Win a round without firing a single bullet", 4, "round"),
    o("obj.gen.deathless-half", "Get through an entire half without dying", 4, "match"),
    o("obj.gen.ninja-defuse", "Get a ninja defuse", 4, "match"),
    o("obj.gen.clutch-defuse", "Defuse the spike in a 1vX", 4, "match"),
    o("obj.gen.fake-defuse", "Win a round off a fake defuse", 3, "match"),
    o("obj.gen.plant-and-clutch", "Plant the spike, then clutch the round alone", 4, "match"),
    o("obj.gen.defuse-bait", "Bait out a defuse and kill them mid-defuse", 2, "match"),
    o("obj.gen.fast-plant", "Plant the spike within the first 30 seconds of a round", 2, "round"),
    o("obj.gen.pistol-round", "Win the opening pistol round", 2, "match"),
    o("obj.gen.eco-frag", "Kill someone holding a rifle while you're on a pistol", 2, "match"),
    o("obj.gen.thrifty", "Win a thrifty round", 3, "match"),
    o("obj.gen.flawless", "Win a round without your team losing anyone", 2, "round"),
    o("obj.gen.enemy-gun", "Pick up an enemy's gun and get a kill with it", 2, "match"),
    o("obj.gen.save", "Save your gun in a round you've already lost", 1, "match"),
    o("obj.gen.top-frag", "Top frag the match", 3, "match"),
    o("obj.gen.most-assists", "Finish with the most assists on your team", 2, "match"),
    o("obj.gen.op-kill", "Buy an Operator and get at least 2 kills with it", 3, "match"),
    o("obj.gen.retake-win", "Win a retake where your team was down a player", 3, "match"),
    o("obj.gen.spike-carry-plant", "Carry and plant the spike in the same round", 1, "round"),
    o("obj.gen.double-entry", "Get the opening kill on two separate rounds", 3, "match"),
    o("obj.gen.comeback", "Win a round after your team drops to a 1v3 or worse", 3, "match"),

    // --- Second content pass ---
    o("obj.gen.smoke-kill", "Get a kill through a smoke", 2, "match"),
    o("obj.gen.close-defuse", "Defuse the spike with under 3 seconds left", 4, "match"),
    o("obj.gen.late-plant", "Plant with under 10 seconds left and win the round", 3, "match"),
    o("obj.gen.low-hp-kill", "Get a kill while on 20 HP or less", 3, "match"),
    o("obj.gen.survive-5hp", "Survive a round on 5 HP or less", 3, "round"),
    o("obj.gen.ult-denial", "Kill someone within 2 seconds of them activating their Ultimate", 4, "match"),
    o("obj.gen.three-headshots", "Land 3 headshots in a single round", 3, "round"),
    o("obj.gen.two-taps", "Get two headshot kills back to back", 3, "match"),
    o("obj.gen.opening-10s", "Get a kill in the first 10 seconds of a round", 2, "match"),
    o("obj.gen.dry-utility", "End a round having used every one of your abilities", 2, "round"),
    o("obj.gen.eco-win", "Win a full eco round", 3, "match"),
    o("obj.gen.revenge", "Kill the player who killed you the round before", 2, "match"),
    o("obj.gen.poor-round", "Win a round where your team spent under 5000 credits total", 3, "round"),
    o("obj.gen.teammate-gun", "Get a kill with a gun a teammate dropped for you", 1, "match"),
    o("obj.gen.last-bullet", "Get a kill with the last bullet in your magazine", 3, "match"),
    o("obj.gen.both-sites", "Get kills on two different sites in the same round", 3, "round"),
    o("obj.gen.no-buy-frag", "Buy nothing for a full round and still get a kill", 3, "round"),
    o("obj.gen.triple-assist", "Assist three different teammates' kills in one round", 3, "round"),
    o("obj.gen.flank-kill", "Kill someone from behind after a flank", 2, "match"),
    o("obj.gen.spike-guard", "Kill two enemies defending your planted spike", 3, "round"),
    o("obj.gen.reload-punish", "Kill someone while they're reloading", 1, "match"),
    o("obj.gen.jump-peek", "Get a kill off a jump peek", 3, "match"),
    o("obj.gen.zero-util-round", "Win a round without using a single ability", 2, "round"),
    o("obj.gen.rifle-half", "Go a whole half without dying to a rifle", 3, "match"),
    o("obj.gen.clean-half", "Win a half without ever being the first to die", 3, "match"),
    o("obj.gen.double-entry-site", "Get the first two kills of a round by yourself", 3, "round"),
    o("obj.gen.anchor", "Hold a site alone and win the round", 3, "round"),
    o("obj.gen.no-trade", "Get a kill where nobody traded you back", 1, "match"),
    o("obj.gen.pistol-vs-rifle", "Win a round where you only ever held a sidearm", 3, "round"),
    o("obj.gen.stopwatch", "Win a round in under 30 seconds", 3, "round"),
    o("obj.gen.overtime", "Win a round that goes to the last 5 seconds", 2, "match"),
    o("obj.gen.util-damage", "Get 100 damage with abilities in a single round", 2, "round"),
    o("obj.gen.full-team-damage", "Damage all five enemies in one round", 3, "round"),
    o("obj.gen.perfect-eco", "End a round with over 8000 credits banked", 2, "match"),
    o("obj.gen.first-and-last", "Get both the first and the last kill of a round", 3, "round"),

    // --- Second content pass: rules ---
    r("rule.play.buy-phase-only", "Buy only during the buy phase — no mid-round pickups or drops", 2, "economy"),
    r("rule.play.no-repeat-angle", "Never peek the same angle twice in one round", 3, "movement"),
    r("rule.play.ping-first", "Ping every enemy before you shoot them", 3, "comms"),
    r("rule.play.buddy-system", "Never take a fight without a teammate in sight", 3, "tempo"),
    r("rule.play.rotate", "Rotate to the other site at least once every round", 3, "site"),
    r("rule.play.floor-crosshair", "Crosshair at the floor until you actually see an enemy", 4, "aim"),
    r("rule.play.no-lineups", "No lineups — everything by eye", 1, "utility"),
    r("rule.play.util-before-gun", "Use at least one ability before you fire a single bullet each round", 2, "utility"),
    r("rule.play.last-buy", "Be the last person on your team to buy every round", 1, "economy"),
    r("rule.play.no-headphones-callouts", "Only call directions, never names of angles", 2, "comms"),
    r("rule.play.always-second", "Never be the first player to enter a site", 2, "tempo"),
    r("rule.play.one-mag", "Never carry more than one spare magazine's worth of fights", 3, "aim"),
    r("rule.play.spike-babysit", "Whoever holds the spike must never take the first fight", 2, "site"),
    r("rule.play.no-jiggle", "No jiggle peeking — commit to every peek", 3, "movement"),
    r("rule.play.shift-in-site", "Always walk once you're inside a site", 3, "movement"),

    // --- Meme / social. Tagged so they're easy to switch off in the pool. ---
    m("meme.spray-on-kill", "Use a spray after every kill", 1),
    m("meme.emote-victim", "Emote on someone you just killed", 2),
    m("meme.gg-every-round", "Type 'gg' in all-chat after every round you win", 1),
    m("meme.no-sprays", "Never use a spray all match", 1),
    m("meme.compliment", "Compliment the enemy who kills you, every time", 1),
    m("meme.dance-plant", "Emote immediately after planting the spike", 3),
    m("meme.announce-ult", "Announce your Ultimate in all-chat before using it", 3),
    m("meme.name-the-gun", "Give your gun a name and use it in every callout", 1),
    m("meme.silent-half", "Say nothing at all for an entire half", 2),
    m("meme.hype-man", "Praise every single teammate kill out loud", 1),
    m("meme.spray-tag", "Leave a spray on every site you take", 2),
    m("meme.thank-the-drop", "Thank whoever drops you a gun, in voice, every time", 1),
  ];

  /** Meme literal — silly, unverifiable, and the ones people actually remember. */
  function m(id, text, difficulty) {
    return {
      id,
      kind: "rule",
      text,
      difficulty,
      scope: "match",
      tags: ["meme", "social"],
      conflictGroup: null,
    };
  }

  /** Rule literal. */
  function r(id, text, difficulty, conflictGroup) {
    return {
      id,
      kind: "rule",
      text,
      difficulty,
      scope: "match",
      tags: ["handicap"],
      conflictGroup: conflictGroup ?? null,
    };
  }

  /** Objective literal. `extra` can name a weapon so the entry picks up its art. */
  function o(id, text, difficulty, scope, extra) {
    return { id, kind: "objective", text, difficulty, scope, tags: ["general"], ...extra };
  }

  // ------------------------------------------------------------------
  // Per-agent combos. Written against the real ability names in
  // assets/js/data/agents.js. These name a specific agent, so they are never
  // `sharable` — a lobby where everyone rolled a different agent can't have a
  // Jett tile. Shared cards get their agent flavour from the slot templates.
  // ------------------------------------------------------------------

  const AGENT_COMBOS = {
    Astra: [
      ["gravity-well-kill", "Kill an enemy caught in your Gravity Well", 2],
      ["nova-pulse-followup", "Concuss with Nova Pulse, then kill them before it wears off", 2],
      ["cosmic-divide-kill", "Get a kill through Cosmic Divide", 3],
      ["stars-placed", "Place all 5 stars before the round timer hits 1:00", 2, "round"],
    ],
    Breach: [
      ["aftershock-kill", "Kill someone with Aftershock", 2],
      ["flash-entry", "Kill an enemy blinded by your Flashpoint", 1],
      ["fault-line-kill", "Kill an enemy staggered by Fault Line", 2],
      ["rolling-thunder-double", "Get 2+ kills during one Rolling Thunder", 3],
    ],
    Brimstone: [
      ["incendiary-kill", "Kill someone with Incendiary", 2],
      ["orbital-kill", "Get a kill with Orbital Strike", 3],
      ["stim-double", "Get 2 kills while inside your own Stim Beacon", 2, "round"],
      ["smoke-punish", "Kill an enemy who walks through your Sky Smoke", 2],
    ],
    Chamber: [
      ["headhunter-round", "Win a round using nothing but Headhunter", 3, "round"],
      ["trademark-kill", "Kill an enemy slowed by your Trademark", 2],
      ["tour-de-force-double", "Get 2 kills with one Tour De Force", 3],
      ["rendezvous-escape", "Take a fight, escape with Rendezvous, and survive the round", 2],
    ],
    Clove: [
      ["not-dead-yet-kill", "Get a kill after dying, during Not Dead Yet", 3],
      ["meddle-kill", "Kill an enemy decayed by Meddle", 2],
      ["pick-me-up-chain", "Get a kill, take Pick-me-up, then get another kill", 2, "round"],
      ["blind-smoke", "Place every Ruse smoke without ever seeing the site", 1, "round"],
    ],
    Cypher: [
      ["trapwire-kill", "Kill an enemy caught in a Trapwire", 2],
      ["spycam-tag", "Tag someone with your Spycam, then kill them", 2],
      ["neural-theft-kill", "Use Neural Theft, then kill someone it revealed", 3],
      ["flank-watch", "Catch and kill a flanker with your setup", 2],
    ],
    Deadlock: [
      ["gravnet-kill", "Kill an enemy tangled in GravNet", 1],
      ["sonic-sensor-kill", "Kill an enemy concussed by your Sonic Sensor", 2],
      ["annihilation-kill", "Get a kill with Annihilation", 3],
      ["barrier-hold", "Block a site entry with Barrier Mesh and win the round", 2, "round"],
    ],
    Fade: [
      ["prowler-kill", "Kill an enemy caught by your Prowler", 1],
      ["seize-kill", "Kill an enemy trapped by Seize", 2],
      ["haunt-kill", "Kill an enemy revealed by Haunt", 1],
      ["nightfall-double", "Get 2+ kills during Nightfall", 3],
    ],
    Gekko: [
      ["wingman-plant", "Let Wingman plant the spike for you", 2],
      ["dizzy-double", "Kill 2 enemies blinded by a single Dizzy", 3, "round"],
      ["mosh-pit-kill", "Kill someone with Mosh Pit", 3],
      ["thrash-kill", "Get a kill with Thrash", 3],
    ],
    Harbor: [
      // Reckoning concusses, it doesn't damage — no kill to be had "with" it.
      ["reckoning-kill", "Kill an enemy concussed by Reckoning", 2],
      ["cove-clutch", "Survive a 1vX by using Cove", 3],
      ["high-tide-kill", "Kill an enemy slowed by High Tide", 2],
      ["water-entry", "Take a site entirely from inside High Tide", 1, "round"],
    ],
    Iso: [
      ["double-tap-chain", "Get 2 kills in a row without losing your Double Tap shield", 3, "round"],
      ["kill-contract-win", "Win a Kill Contract duel", 3],
      ["undercut-kill", "Kill an enemy made vulnerable by Undercut", 1],
      ["contingency-entry", "Entry a site behind Contingency and get the opening kill", 2],
    ],
    Jett: [
      ["knife-after-dash", "Get a knife kill immediately after a Tailwind dash", 4],
      ["updraft-kill", "Get a kill while airborne from Updraft", 2],
      ["blade-storm-triple", "Get 3+ kills in one Blade Storm", 3],
      ["op-dash", "Take an Operator shot, dash out, and survive the round", 2],
    ],
    "KAY/O": [
      ["frag-kill", "Kill someone with FRAG/ment", 2],
      ["zero-point-kill", "Kill an enemy suppressed by ZERO/point", 2],
      ["flash-kill", "Kill an enemy blinded by FLASH/drive", 1],
      ["get-revived", "Get downed during NULL/cmd and be revived by a teammate", 2],
    ],
    Killjoy: [
      ["nanoswarm-kill", "Kill someone with Nanoswarm", 2],
      ["turret-kill", "Let your TURRET get the kill", 2],
      ["alarmbot-kill", "Kill an enemy tagged by your ALARMBOT", 2],
      ["lockdown-win", "Win a round where Lockdown detained at least one enemy", 3, "round"],
    ],
    Miks: [
      ["bassquake-kill", "Get a kill during Bassquake", 3],
      ["waveform-kill", "Kill an enemy caught by Waveform", 2],
      ["m-pulse-kill", "Get a kill with M-pulse", 2],
      ["harmonize-assists", "Get 2 assists in one round through Harmonize", 2, "round"],
    ],
    Neon: [
      ["slide-kill", "Get a kill mid-slide", 3],
      ["overdrive-triple", "Get 3+ kills in one Overdrive", 4],
      ["relay-bolt-kill", "Kill an enemy concussed by Relay Bolt", 2],
      ["fast-lane-entry", "Entry a site down Fast Lane and survive it", 2],
    ],
    Omen: [
      ["from-the-shadows-kill", "Get a kill right after teleporting with From the Shadows", 3],
      ["paranoia-kill", "Kill an enemy blinded by Paranoia", 1],
      ["shrouded-step-kill", "Get a kill within 3 seconds of a Shrouded Step", 2],
      ["one-way-kill", "Get a kill through a Dark Cover one-way", 3],
    ],
    Phoenix: [
      ["run-it-back-profit", "End Run it Back with more kills than you went in with", 3],
      ["curveball-kill", "Kill an enemy blinded by Curveball", 1],
      ["hot-hands-kill", "Kill someone with Hot Hands", 2],
      ["wall-kill", "Get a kill through your own Blaze wall", 2],
    ],
    Raze: [
      ["boom-bot-kill", "Let the Boom Bot get a kill", 2],
      ["satchel-air-kill", "Get a kill while airborne from a Blast Pack", 3],
      ["showstopper-double", "Get 2+ kills with one Showstopper", 3],
      ["paint-shells-kill", "Kill someone with Paint Shells", 2],
    ],
    Reyna: [
      ["empress-triple", "Get 3+ kills during a single Empress", 3],
      ["dismiss-reangle", "Dismiss out of a fight and kill them from a new angle", 2],
      ["leer-kill", "Kill an enemy looking at your Leer", 1],
      ["devour-chain", "Devour to full overheal, then get another kill", 2, "round"],
    ],
    Sage: [
      ["res-and-win", "Resurrect a teammate and go on to win the round", 2, "round"],
      ["slow-orb-kill", "Kill an enemy slowed by your Slow Orb", 1],
      ["wall-hold", "Block a site with Barrier Orb and win the round", 2, "round"],
      ["heal-the-clutch", "Heal a teammate who then clutches the round", 3],
    ],
    Skye: [
      ["trailblazer-kill", "Get at least 1 kill using Trailblazer", 2],
      ["guiding-light-kill", "Kill an enemy blinded by Guiding Light", 1],
      ["seekers-kill", "Kill an enemy tagged by your Seekers", 2],
      ["regrowth-full", "Heal 3 teammates to full with Regrowth in one round", 2, "round"],
    ],
    Sova: [
      ["shock-bolt-kill", "Kill someone with a Shock Bolt", 3],
      ["owl-drone-kill", "Get a kill with an Owl Drone dart", 2],
      ["hunters-fury-double", "Get 2+ kills with one Hunter's Fury", 3],
      ["recon-lineup", "Kill an enemy revealed by a Recon Bolt lineup", 1],
    ],
    Tejo: [
      ["armageddon-kill", "Get a kill with Armageddon", 3],
      ["guided-salvo-kill", "Get a kill with Guided Salvo", 3],
      ["special-delivery-kill", "Kill an enemy concussed by Special Delivery", 2],
      ["stealth-drone-kill", "Suppress an enemy with Stealth Drone, then kill them", 2],
    ],
    Veto: [
      ["evolution-kill", "Get a kill during Evolution", 3],
      ["interceptor-block", "Deny an enemy ability with Interceptor", 2],
      ["chokehold-kill", "Kill an enemy caught in Chokehold", 2],
      ["crosscut-kill", "Get a kill with Crosscut", 2],
    ],
    Viper: [
      ["pit-double", "Get 2+ kills inside Viper's Pit", 3],
      ["snake-bite-kill", "Kill someone with Snake Bite decay", 3],
      ["toxic-screen-kill", "Get a kill through your Toxic Screen", 2],
      ["post-plant-molly", "Get a post-plant Snake Bite kill off a lineup", 3],
    ],
    Vyse: [
      ["steel-garden-kill", "Kill an enemy whose gun you jammed with Steel Garden", 3],
      ["arc-rose-kill", "Kill an enemy blinded by Arc Rose", 1],
      ["shear-kill", "Kill an enemy stopped by Shear", 2],
      ["razorvine-kill", "Kill an enemy caught in Razorvine", 2],
    ],
    Waylay: [
      ["refract-escape", "Take damage, Refract away, then get the kill", 3],
      ["convergent-paths-double", "Get 2+ kills during Convergent Paths", 3],
      ["lightspeed-entry", "Entry a site with Lightspeed and get the opening kill", 2],
      ["saturate-kill", "Kill an enemy slowed by Saturate", 2],
    ],
    Yoru: [
      ["gatecrash-kill", "Get a kill immediately after a GATECRASH teleport", 3],
      ["blindside-kill", "Kill an enemy blinded by BLINDSIDE", 1],
      ["fakeout-bait", "Kill someone who shot your FAKEOUT clone", 2],
      ["drift-scout-kill", "Scout with DIMENSIONAL DRIFT, then kill someone you found", 3],
    ],
  };

  /**
   * Second pass of agent combos, kept as its own table rather than edited into
   * the one above — appending is the safe operation here, and a diff that only
   * adds lines is easy to review against the invariants at the top of the file.
   */
  const AGENT_COMBOS_2 = {
    Astra: [["astral-spot", "Kill someone you first spotted from Astral Form", 2]],
    Breach: [["blind-stun-wall", "Kill an enemy you stunned through a wall you couldn't see past", 3]],
    Brimstone: [["orbital-postplant", "Get a post-plant kill with Orbital Strike", 3]],
    Chamber: [["rendezvous-anchor", "Hold a site alone with Rendezvous and survive the round", 3]],
    Clove: [["dead-plant", "Plant or defuse the spike while dead during Not Dead Yet", 4]],
    Cypher: [["cam-assist", "Get a kill off information your Spycam gave a teammate", 2]],
    Deadlock: [["annihilation-clutch", "Win a 1v2 or better using Annihilation", 4]],
    Fade: [["nightfall-ace", "Get 3+ kills in the round you popped Nightfall", 4]],
    Gekko: [["reclaim-double", "Reclaim Dizzy or Wingman and get a kill with the second use", 3]],
    Harbor: [["reckoning-plant", "Plant the spike while Reckoning is going off", 3]],
    Iso: [["two-contracts", "Win two separate Kill Contract duels in one match", 4]],
    Jett: [["cloud-op", "Take an Operator shot from inside your own Cloudburst", 2]],
    "KAY/O": [["nullcmd-push", "Take a site during NULL/cmd without losing anyone", 3]],
    Killjoy: [["full-setup", "Get a kill with every one of your gadgets in the same match", 4]],
    Miks: [["bassquake-take", "Take a site while Bassquake is active", 3]],
    Neon: [["overdrive-slide", "Get an Overdrive kill straight out of a slide", 4]],
    Omen: [["shadow-survive", "Get shot mid-teleport during From the Shadows and still complete it", 3]],
    Phoenix: [["through-the-wall", "Walk through your own Blaze wall and get the kill on the other side", 2]],
    Raze: [["double-satchel", "Cross an entire site on two Blast Packs and get a kill", 3]],
    Reyna: [["invis-dismiss", "Escape a lost fight with an invisible Dismiss during Empress", 2]],
    Sage: [["wall-boost", "Get a kill from a Barrier Orb boost", 3]],
    Skye: [["dog-and-flash", "Trailblazer and Guiding Light on the same push, then take the kill", 3]],
    Sova: [["full-recon", "Find all five enemies in a single round with your recon", 3]],
    Tejo: [["armageddon-postplant", "Get a post-plant kill with Armageddon", 3]],
    Veto: [["evolution-entry", "Entry a site during Evolution and survive it", 3]],
    Viper: [["fuel-discipline", "Hold a site for a full round without your fuel running out", 3]],
    Vyse: [["jam-and-trade", "Jam a gun with Steel Garden and let a teammate take the kill", 2]],
    Waylay: [["paths-both-sites", "Catch defenders from both sites with one Convergent Paths", 3]],
    Yoru: [["full-fake", "Win a round where you faked a site take with FAKEOUT and GATECRASH", 3]],
  };

  // ------------------------------------------------------------------
  // Per-agent ability challenges
  //
  // Generated from the `abilityKinds` data rather than templated over slots, so
  // a challenge only exists where the ability can actually do the thing. Named
  // agents mean these are never `sharable` — that's the trade for accuracy, and
  // it's forced: Sage and Astra have no lethal ability, so no kill-based slot
  // template could ever be valid for the whole roster.
  // ------------------------------------------------------------------

  const KILL_KINDS = ["lethal"];
  const ASSIST_KINDS = ["lethal", "control", "recon"];

  /** How to describe an enemy that ability has been used on. */
  const AFFECTED_VERB = {
    control: "caught by",
    recon: "revealed by",
    lethal: "damaged by",
  };

  const ABILITY_FAMILIES = [
    {
      family: "obj.ability.kill-with",
      kinds: KILL_KINDS,
      scope: "match",
      text: (name) => `Get at least 1 kill with ${name}`,
      difficulty: (slot) => (slot === "X" ? 3 : 2),
    },
    {
      family: "obj.ability.double-kill",
      kinds: KILL_KINDS,
      scope: "round",
      text: (name) => `Get 2 kills from a single ${name}`,
      difficulty: () => 4,
    },
    {
      family: "obj.ability.combo",
      kinds: KILL_KINDS,
      scope: "match",
      text: (name) => `Get a kill within 3 seconds of using ${name}`,
      difficulty: () => 2,
    },
    {
      family: "obj.ability.affected",
      kinds: ["control", "recon"],
      scope: "match",
      text: (name, kind) => `Kill an enemy ${AFFECTED_VERB[kind]} ${name}`,
      difficulty: () => 2,
    },
    {
      family: "obj.ability.assist",
      kinds: ASSIST_KINDS,
      scope: "round",
      text: (name) => `Get 2 assists in one round with ${name}`,
      difficulty: () => 3,
    },
    {
      family: "obj.ability.entry",
      kinds: ASSIST_KINDS,
      scope: "match",
      text: (name) => `Get the opening kill of a round off ${name}`,
      difficulty: () => 3,
    },
  ];

  function expandAbilityChallenges() {
    const out = [];
    for (const agent of VF.cardsData) {
      for (const slot of ["C", "Q", "E", "X"]) {
        const kind = agent.abilityKinds && agent.abilityKinds[slot];
        const name = agent.abilities[slot];
        if (!kind || !name) continue;
        for (const family of ABILITY_FAMILIES) {
          if (!family.kinds.includes(kind)) continue;
          out.push({
            id: `${family.family}/${slugify(agent.title)}/${slot.toLowerCase()}`,
            kind: "objective",
            text: family.text(name, kind),
            difficulty: family.difficulty(slot),
            scope: family.scope,
            tags: ["agent", "utility"],
            agent: agent.title,
          });
        }
      }
    }
    return out;
  }

  // ------------------------------------------------------------------
  // Expansion
  // ------------------------------------------------------------------

  /** Cartesian product of `{ key: [values] }` into an array of param objects. */
  function cartesian(params) {
    let rows = [{}];
    for (const [key, values] of Object.entries(params)) {
      const next = [];
      for (const row of rows) for (const value of values) next.push({ ...row, [key]: value });
      rows = next;
    }
    return rows;
  }

  const pick = (fn, params, fallback) =>
    typeof fn === "function" ? fn(params) : fn !== undefined ? fn : fallback;

  function finalize(entry) {
    const e = {
      slots: [],
      tags: [],
      scope: "match",
      agent: null,
      role: null,
      weapon: null,
      conflictGroup: null,
      since: 1,
      removedIn: null,
      ...entry,
    };
    e.points = DIFFICULTY_POINTS[e.difficulty];
    // Sharability — the structural fix for cross-player desync. A shared card may
    // only hold tiles that are identically eligible for every player, whatever
    // agent they rolled. C/Q/E/X exist on all 29 agents; `passive` does not, and
    // an agent-named tile obviously can't apply to a lobby.
    //
    // Computed here rather than trusted from the stored object, because custom
    // challenges are re-finalized on every read — an earlier version recomputed
    // this to `true` and quietly let one player's private challenges into a
    // shared card. A custom entry only exists on the machine that wrote it, so
    // it can never be sharable regardless of its other fields.
    e.sharable =
      !e.custom && e.agent === null && e.role === null && !e.slots.includes("passive");
    return e;
  }

  function expand() {
    const out = [];

    for (const generator of GENERATORS) {
      for (const params of cartesian(generator.params)) {
        out.push(
          finalize({
            id: `${generator.family}/${generator.id(params)}`,
            kind: generator.kind,
            text: generator.text(params),
            slots: pick(generator.slots, params, []),
            difficulty: clampDifficulty(generator.difficulty(params)),
            tags: generator.tags,
            scope: generator.scope,
            weapon: pick(generator.weapon, params, null),
            role: pick(generator.role, params, null),
            conflictGroup: generator.conflictGroup ?? null,
          }),
        );
      }
    }

    for (const literal of LITERALS) out.push(finalize(literal));

    for (const entry of expandAbilityChallenges()) out.push(finalize(entry));

    for (const table of [AGENT_COMBOS, AGENT_COMBOS_2]) {
      for (const [agent, combos] of Object.entries(table)) {
        for (const [suffix, text, difficulty, scope] of combos) {
          out.push(
            finalize({
              id: `obj.agent.${slugify(agent)}/${suffix}`,
              kind: "objective",
              text,
              difficulty,
              scope: scope ?? "match",
              tags: ["agent", "utility"],
              agent,
            }),
          );
        }
      }
    }

    // Canonical order. Seeded draws consume this array positionally, so it must
    // not depend on how the generators happened to be listed above.
    return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  const CATALOG = expand();
  const CATALOG_BY_ID = new Map(CATALOG.map((e) => [e.id, e]));

  /** Dev-only. Call from the console after editing this file. */
  function assertIntegrity() {
    const problems = [];
    const seen = new Set();
    for (const e of CATALOG) {
      if (seen.has(e.id)) problems.push(`duplicate id: ${e.id}`);
      seen.add(e.id);
      if (!/^[a-z0-9./_-]+$/.test(e.id)) problems.push(`malformed id: ${e.id}`);
      if (!DIFFICULTY_POINTS[e.difficulty]) problems.push(`bad difficulty: ${e.id}`);
      if (e.since > VF.seed.CATALOG_VERSION) problems.push(`since is in the future: ${e.id}`);
      const used = [...e.text.matchAll(SLOT_RE)].map((m) => m[1]);
      for (const slot of used) {
        if (!e.slots.includes(slot)) problems.push(`undeclared slot {${slot}} in ${e.id}`);
      }
      for (const slot of e.slots) {
        if (!used.includes(slot)) problems.push(`declared but unused slot ${slot} in ${e.id}`);
      }
      if (e.agent && !VF.AGENTS_BY_TITLE.has(e.agent)) problems.push(`unknown agent: ${e.id}`);
    }
    if (problems.length) {
      for (const p of problems) console.error(p);
    }
    console.log(
      `${CATALOG.length} entries — ${CATALOG.filter((e) => e.sharable).length} sharable, ` +
        `${CATALOG.filter((e) => e.kind === "objective").length} objectives, ` +
        `${CATALOG.filter((e) => e.kind === "rule").length} rules, ` +
        `${problems.length} problems`,
    );
    return problems;
  }

  VF.catalog = {
    DIFFICULTY_POINTS,
    SLOT_RE,
    GENERIC_SLOT_LABEL,
    CATALOG,
    CATALOG_BY_ID,
    renderChallengeText,
    finalize,
    slugify,
    assertIntegrity,
    get: (id) => CATALOG_BY_ID.get(id),
  };
})(window.VF);
