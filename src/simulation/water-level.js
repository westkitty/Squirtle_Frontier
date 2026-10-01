// The basin's water level, derived from the wetland node rather than stored.
//
// Before this, water in the movement region was a fixed authored volume: an ellipse with
// a hardcoded shoreline. Now one number moves the predicate the body swims by, the shore
// the herd drinks at and the painted shallows, so the shoreline you can see is the
// shoreline you get wet in, and it answers to the watershed you changed.
//
// Nothing here simulates a fluid. One node's wetness sets one height, every consumer reads
// that height, and the level is derived rather than saved: restoring the graph restores it.
import { WORLD } from "../worldgen.js";

// The surface the body floats on, exactly as the movement slice authored it. Keeping this
// value is deliberate: an undisturbed save must behave as it always did.
export const WATER_BASE = WORLD.water;
// How far below the surface a point has to be before the body counts it as water, so the
// rim you can walk on stays the width it has always been.
export const WATER_SHORE = 0.05;
// The painted shallows float a hair above the surface, as they have since phase 1.
export const WATER_PAINT_LIFT = 0.015;
// The wetland's supply when the landslide is untouched, measured rather than chosen:
// `Watershed` converges the wetland node here at the authored 0.95 blockage.
export const WETLAND_PRISTINE = 0.05;
// The level interpolates between two ends and is anchored on the undisturbed line, so it
// can never flood or uncover the basin by more than the numbers below.
export const WATER_FULL_RISE = 0.28; // reached when the wetland is at full supply
export const WATER_DRY_DROP = 0.05; // reached when the wetland has nothing left

export function waterLevelFor(wetness) {
  const w = Number.isFinite(wetness) ? Math.max(0, Math.min(1, wetness)) : 0;
  const delta =
    w >= WETLAND_PRISTINE
      ? ((w - WETLAND_PRISTINE) / (1 - WETLAND_PRISTINE)) * WATER_FULL_RISE
      : -(((WETLAND_PRISTINE - w) / WETLAND_PRISTINE) * WATER_DRY_DROP);
  return WATER_BASE + +delta.toFixed(6);
}

export const WATER_SHORELINE = (level) => level - WATER_SHORE;
export const WATER_SURFACE_Y = (level) => level + WATER_PAINT_LIFT;

// How much of a named inflow is holding water right now, sampled through the same probe
// the body trusts. A route can therefore never be reported as running where you would not
// get wet. The mouth always sits in the basin, so the samples that count are the ones
// above it: that is what makes a gully a run rather than a pool.
export const REACH_FLOW_FRACTION = 0.15;
export function reachWaterFraction(reach, isWater) {
  const points = reach?.points ?? [];
  if (points.length < 3) return 0;
  let wet = 0;
  for (let i = 1; i < points.length - 1; i++)
    if (isWater(points[i].x, points[i].z)) wet++;
  return wet / (points.length - 2);
}

export function reachWaterState(reach, isWater) {
  const fraction = reachWaterFraction(reach, isWater);
  return { fraction, flowing: fraction >= REACH_FLOW_FRACTION };
}
