import { Settlement } from "./simulation/settlement.js";
import { FrontierSystems } from "./simulation/frontier-systems.js";
import { PlaceMemory } from "./simulation/place-memory.js";
import { Watershed } from "./simulation/watershed.js";
import { Ecosystem } from "./simulation/ecosystem.js";
export const SAVE_KEY = "squirtle_frontier_baseline_v1";
export const BACKUP_KEY = SAVE_KEY + "_backup";
export const MAX_OFFLINE_SECONDS = 6 * 60 * 60;
const position = (p) =>
  p &&
  Number.isFinite(p.x) &&
  Number.isFinite(p.z) &&
  Math.abs(p.x) <= 1000 &&
  Math.abs(p.z) <= 1000;
function decode(text, seed) {
  const s = JSON.parse(text);
  if (
    ![1, 2, 3, 4, 5].includes(s.version) ||
    s.seed !== seed ||
    !Number.isFinite(s.elapsed) ||
    s.elapsed < 0 ||
    !position(s.player)
  )
    throw new Error("Unsupported or damaged save");
  const watershed =
    s.version === 1
      ? new Watershed()
      : Watershed.restore(s.watershed, s.version < 4);
  const ecosystem =
    s.version < 3 ? new Ecosystem(seed) : Ecosystem.restore(s.ecosystem, seed);
  if (
    s.version >= 3 &&
    (!Number.isFinite(s.savedAt) ||
      s.savedAt < 0 ||
      !Number.isFinite(s.ecoRemainder) ||
      s.ecoRemainder < 0 ||
      s.ecoRemainder >= 1 ||
      !["frontier", "lab", "record"].includes(s.place) ||
      !position(s.frontierReturn))
  )
    throw new Error("Invalid world clock or location");
  const frontier =
    s.version < 4
      ? new FrontierSystems(seed, Math.round(s.elapsed - (s.ecoRemainder || 0)))
      : FrontierSystems.restore(s.frontier, seed);
  const memory =
    s.version < 4 ? new PlaceMemory(seed) : PlaceMemory.restore(s.memory, seed);
  const settlement =
    s.version < 5 ? new Settlement() : Settlement.restore(s.settlement);
  return { s, watershed, ecosystem, frontier, memory, settlement };
}
export function advanceOffline(state, seconds) {
  if (!Number.isFinite(seconds) || seconds < 0)
    return { seconds: 0, capped: false };
  const ticks = Math.min(MAX_OFFLINE_SECONDS, Math.floor(seconds));
  // Same one-second regional integrator as active play; no body/camera/renderer replay.
  for (let i = 0; i < ticks; i++) state.update(1);
  return { seconds: ticks, capped: seconds > MAX_OFFLINE_SECONDS };
}
export function save(state, storage, now = Date.now()) {
  try {
    if (state.persistenceBlocked)
      throw new Error(
        "Saving paused to preserve damaged or conflicting data. Export or repair the stored save before reloading.",
      );
    if (!Number.isFinite(now) || now < 0) throw new Error("Invalid save clock");
    const old = storage.getItem(SAVE_KEY);
    if (old != null && old !== state.storageText)
      throw new Error("Save changed in another tab; reload before saving.");
    const text = JSON.stringify({
      ...state.snapshot(),
      savedAt: Math.max(now, old ? JSON.parse(old).savedAt || 0 : 0),
    });
    decode(text, state.seed);
    if (old) storage.setItem(BACKUP_KEY, old);
    storage.setItem(SAVE_KEY, text);
    state.storageText = text;
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}
export function load(
  state,
  storage,
  { now = Date.now(), offline = true } = {},
) {
  try {
    const text = storage.getItem(SAVE_KEY);
    if (!text) {
      state.storageText = text;
      return { ok: true, fresh: true };
    }
    let decoded,
      recovered = false;
    try {
      decoded = decode(text, state.seed);
    } catch (original) {
      const backup = storage.getItem(BACKUP_KEY);
      if (!backup) throw original;
      decoded = decode(backup, state.seed);
      recovered = true;
    }
    const { s, watershed, ecosystem, frontier, memory, settlement } = decoded;
    state.watershed = watershed;
    state.ecosystem = ecosystem;
    state.frontier = frontier;
    state.memory = memory;
    state.settlement = settlement;
    state.elapsed = s.elapsed;
    state.ecoRemainder = s.version >= 3 ? s.ecoRemainder : 0;
    state.player = { x: s.player.x, z: s.player.z };
    state.place = s.version >= 3 ? s.place : "frontier";
    state.frontierReturn =
      s.version >= 3 ? { ...s.frontierReturn } : { x: -10, z: 18 };
    state.storageText = text;
    state.persistenceBlocked = recovered;
    const gap =
      offline && s.version >= 3 && Number.isFinite(now)
        ? Math.max(0, (now - s.savedAt) / 1000)
        : 0;
    const advanced = advanceOffline(state, gap);
    // Consume wall time before enabling play. Failed writes never destroy the valid source.
    if (offline && !recovered) {
      const written = save(state, storage, now);
      if (!written.ok) {
        state.persistenceBlocked = true;
        return { ok: true, ...advanced, message: written.message };
      }
    }
    return {
      ok: true,
      ...advanced,
      recovered,
      message: recovered
        ? "Recovered backup. Saving paused; damaged primary retained."
        : undefined,
    };
  } catch (error) {
    state.persistenceBlocked = true;
    return {
      ok: false,
      message: `${error.message}; original retained and saving paused.`,
    };
  }
}

// Explicit replacement always quarantines the prior bytes first. Quota failure aborts.
export const QUARANTINE_KEY = SAVE_KEY + "_quarantine";
export function exportSave(storage, key = SAVE_KEY) {
  return storage.getItem(key) || "";
}
export function replaceSave(state, storage, text) {
  try {
    if (typeof text !== "string" || text.length > 2_000_000)
      throw new Error("Save exceeds import limit");
    decode(text, state.seed);
    const previous = storage.getItem(SAVE_KEY);
    if (previous) storage.setItem(QUARANTINE_KEY, previous);
    storage.setItem(SAVE_KEY, text);
    // Existing page must reload; its state must not overwrite the imported generation.
    state.persistenceBlocked = true;
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}
export function recoverBackup(state, storage) {
  try {
    return replaceSave(state, storage, storage.getItem(BACKUP_KEY));
  } catch (error) {
    return { ok: false, message: error.message };
  }
}
