// Versioned semantic save; full recovery/offline simulation remains pending.
import { Watershed } from "./simulation/watershed.js";
const KEY = "squirtle_frontier_baseline_v1";
export function save(state, storage) {
  try {
    storage.setItem(KEY, JSON.stringify(state.snapshot()));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}
export function load(state, storage) {
  try {
    const text = storage.getItem(KEY);
    if (!text) return { ok: true, fresh: true };
    const s = JSON.parse(text);
    if (
      ![1, 2].includes(s.version) ||
      s.seed !== state.seed ||
      !Number.isFinite(s.elapsed) ||
      s.elapsed < 0 ||
      !Number.isFinite(s.player?.x) ||
      !Number.isFinite(s.player?.z) ||
      Math.abs(s.player.x) > 1000 ||
      Math.abs(s.player.z) > 1000
    )
      throw new Error(
        "Unsupported or damaged baseline save; original retained.",
      );
    const watershed =
      s.version === 1 ? new Watershed() : Watershed.restore(s.watershed);
    state.watershed = watershed;
    state.elapsed = s.elapsed;
    state.player = { x: s.player.x, z: s.player.z };
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}
