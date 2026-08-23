// pool.js — decides which challenges a run may draw from.
//
// This is the file that makes shared cards actually work. A seeded run ignores
// the player's local customisation entirely: if it didn't, someone who disabled
// 40 challenges and added 5 of their own would open the same `?c=` link as their
// friend and see a different card, which defeats the whole point.

(function (VF) {
  "use strict";

  const DISABLED_KEY = "challenges/disabled";
  const CUSTOM_KEY = "challenges/custom";

  const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  /**
   * Disabled ids are stored rather than enabled ones. The agent pool stores the
   * *enabled* set, which means anything shipped later defaults to excluded —
   * fine for 29 agents, wrong for a catalog that grows by dozens at a time.
   */
  const getDisabled = () => new Set(VF.store.read(DISABLED_KEY, []));

  function setDisabled(set) {
    VF.store.write(DISABLED_KEY, [...set]);
  }

  function isDisabled(id) {
    return getDisabled().has(id);
  }

  function setEnabled(id, enabled) {
    const disabled = getDisabled();
    if (enabled) disabled.delete(id);
    else disabled.add(id);
    setDisabled(disabled);
  }

  /** Stored entries are already finalized, but re-finalize defensively in case
   *  the schema gained a field since they were written. */
  const getCustom = () => VF.store.read(CUSTOM_KEY, []).map((e) => VF.catalog.finalize(e));

  function addCustom(entry) {
    const custom = VF.store.read(CUSTOM_KEY, []);
    custom.push(entry);
    VF.store.write(CUSTOM_KEY, custom);
    return entry;
  }

  function removeCustom(id) {
    VF.store.write(
      CUSTOM_KEY,
      VF.store.read(CUSTOM_KEY, []).filter((e) => e.id !== id),
    );
  }

  /**
   * @param {{seed: Object|null, agentMode?: number, diffMask?: number}} options
   * @returns {{pool: Object[], shared: boolean, agentMode: number, diffMask: number}}
   */
  function resolve({ seed = null, agentMode = 0, diffMask = 0b1111 } = {}) {
    const { CATALOG } = VF.catalog;
    const shared = seed !== null;
    let pool;

    if (shared) {
      // Pinned to the catalog version baked into the seed, so a card shared
      // months ago still regenerates exactly even though the catalog has grown.
      pool = CATALOG.filter(
        (e) =>
          e.sharable &&
          e.since <= seed.catalog &&
          (e.removedIn === null || e.removedIn > seed.catalog),
      );
      agentMode = seed.agentMode;
      diffMask = seed.diffMask;
    } else {
      const disabled = getDisabled();
      pool = CATALOG.filter((e) => e.removedIn === null && !disabled.has(e.id)).concat(
        getCustom().filter((e) => !disabled.has(e.id)),
      );
    }

    pool = pool.filter((e) => diffMask & (1 << (e.difficulty - 1)));

    if (agentMode === 0) {
      // "Any agent" — nothing that depends on which agent you're playing.
      pool = pool.filter((e) => !e.slots.length && !e.agent && !e.role);
    }

    // Canonical order. The seeded shuffle consumes this positionally, so two
    // clients must build the identical array before shuffling.
    return { pool: pool.sort(byId), shared, agentMode, diffMask };
  }

  /**
   * Restricts an unshared pool to the agent actually being played. Shared runs
   * never call this — their tile ids must be agent-independent.
   */
  function forAgent(pool, agentTitle) {
    if (!agentTitle) return pool.filter((e) => !e.agent && !e.role);
    const agent = VF.AGENTS_BY_TITLE.get(agentTitle);
    return pool.filter(
      (e) =>
        (e.agent === null || e.agent === agentTitle) &&
        (e.role === null || (agent && e.role === agent.role)),
    );
  }

  /** Live counts for the mode picker's "N challenges available" readout. */
  function counts(options, agentTitle) {
    const { pool, agentMode } = resolve(options);
    const scoped = options.seed || agentMode === 0 ? pool : forAgent(pool, agentTitle);
    return {
      total: scoped.length,
      objectives: scoped.filter((e) => e.kind === "objective").length,
      rules: scoped.filter((e) => e.kind === "rule").length,
    };
  }

  VF.pool = {
    resolve,
    forAgent,
    counts,
    byId,
    getDisabled,
    setDisabled,
    setEnabled,
    isDisabled,
    getCustom,
    addCustom,
    removeCustom,
  };
})(window.VF);
