import { heightAt } from "../worldgen.js";
import { traceChannel } from "./frontier-systems.js";
// Generated from the immutable base terrain, not from its own carved result.
export const CHANNEL_ROUTE = Object.freeze(
  traceChannel().map((p) => Object.freeze(p)),
);
export const CHANNEL_BOUNDS = Object.freeze({
  minX: Math.min(...CHANNEL_ROUTE.map((p) => p.x)) - 0.7,
  maxX: Math.max(...CHANNEL_ROUTE.map((p) => p.x)) + 0.7,
  minZ: Math.min(...CHANNEL_ROUTE.map((p) => p.z)) - 0.7,
  maxZ: Math.max(...CHANNEL_ROUTE.map((p) => p.z)) + 0.7,
});
export const CHANNEL_DEPTH = Object.freeze([0, 0.025, 0.07, 0.14, 0.22]);
export function channelDistance(x, z) {
  let best = Infinity;
  for (let i = 1; i < CHANNEL_ROUTE.length; i++) {
    const a = CHANNEL_ROUTE[i - 1],
      b = CHANNEL_ROUTE[i],
      dx = b.x - a.x,
      dz = b.z - a.z;
    const t = Math.max(
      0,
      Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)),
    );
    best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return best;
}
export function channelHeight(x, z, stage = 0) {
  const base = heightAt(x, z);
  if (stage === 0) return base;
  const { minX, maxX, minZ, maxZ } = CHANNEL_BOUNDS;
  if (x < minX || x > maxX || z < minZ || z > maxZ) return base;
  const width = 0.22 + stage * 0.055;
  const d = channelDistance(x, z),
    profile = Math.max(0, 1 - d / width);
  return base - CHANNEL_DEPTH[stage] * profile * profile;
}
export function channelSample(x, z, stage) {
  const e = 0.15;
  return {
    height: channelHeight(x, z, stage),
    dx:
      (channelHeight(x + e, z, stage) - channelHeight(x - e, z, stage)) /
      (2 * e),
    dz:
      (channelHeight(x, z + e, stage) - channelHeight(x, z - e, stage)) /
      (2 * e),
  };
}
