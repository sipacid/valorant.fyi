// store.js — localStorage helpers. Every key is namespaced under `valorant.fyi/`
// and every access is guarded: private-browsing modes throw on access rather
// than returning null, and the site has to keep working.
//
// "Keep working" means more than not crashing. An in-memory mirror backs every
// key, so when localStorage is unavailable a bingo card or gauntlet run still
// behaves normally for the rest of the session — it just doesn't survive a
// reload. Without it, saving a run appeared to succeed while loading it always
// returned nothing, and the run screen bounced straight back to the picker.

(function (VF) {
  "use strict";

  const PREFIX = "valorant.fyi/";
  const memory = new Map();

  function read(key, fallback) {
    let raw = null;
    try {
      raw = localStorage.getItem(PREFIX + key);
    } catch {
      raw = null;
    }
    // Falls through to memory both when storage throws and when a previous
    // write silently failed, leaving the key absent.
    if (raw === null && memory.has(key)) raw = memory.get(key);
    if (raw === null || raw === undefined) return fallback;
    try {
      const value = JSON.parse(raw);
      return value === null || value === undefined ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    const raw = JSON.stringify(value);
    memory.set(key, raw);
    try {
      localStorage.setItem(PREFIX + key, raw);
      return true;
    } catch {
      return false;
    }
  }

  function remove(key) {
    memory.delete(key);
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      // nothing to do
    }
  }

  VF.store = { read, write, remove, PREFIX };
})(window.VF);
