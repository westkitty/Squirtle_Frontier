// The shape of the water you can see.
//
// Before this, the visible pond was a fixed ellipse mesh that never changed: the body
// swam by `waterAt()` (ellipse intersected with terrain below the shoreline) while the
// picture was `CircleGeometry` scaled to the same ellipse. Raising the basin by repairing
// the watershed therefore moved the water the body swims in by metres and moved the water
// on screen by nothing, which made the project's central causal payoff - you mend the
// waterway and the shoreline answers - invisible.
//
// So the outline is not authored here. It is *measured* from the same predicate the body
// swims by, one ray at a time, and it is re-measured whenever the level moves. The visible
// shoreline and the wet shoreline are the same shoreline because they are the same
// function, not because two constants agree.
import { waterAt } from "./movement-region.js";

// One spoke per 3.75 degrees. The pond's outline is smooth at this scale, and the whole
// mesh is under 600 vertices, so there is no reason to be coarser.
export const POND_SPOKES = 96;
// Rings are flat, so their count only sets how coarsely the interior is triangulated; the
// silhouette is carried entirely by the outermost ring.
export const POND_RINGS = 6;
// The longest axis of the authored basin is 31 m. Nothing can lie outside it, because the
// predicate itself refuses points outside the ellipse.
export const POND_MAX_RADIUS = 32;
const MARCH_STEP = 0.5;
// 0.5 m step, then eight halvings: the shore lands within two centimetres of the predicate.
const BISECTIONS = 8;
// A level is only worth re-measuring when it has actually moved. The whole range a basin
// can travel is 0.33 m, so a tenth of a millimetre of tolerance cannot hide a shoreline
// move: it can only stop floating-point noise from rebuilding the same outline.
export const LEVEL_EPSILON = 1e-4;

export function levelChanged(previous, next) {
  if (!Number.isFinite(next)) return false;
  if (previous === null || !Number.isFinite(previous)) return true;
  return Math.abs(next - previous) >= LEVEL_EPSILON;
}

// Where the water stops along one direction from the basin centre. Walks outward until the
// predicate says dry, then closes in on the crossing rather than reporting the sample it
// happened to land on.
export function pondShoreRadius(isWet, angle, maxRadius = POND_MAX_RADIUS) {
  const cx = Math.cos(angle),
    cz = Math.sin(angle);
  let wet = 0,
    dry = null;
  for (let r = MARCH_STEP; r <= maxRadius + 1e-9; r += MARCH_STEP) {
    if (isWet(cx * r, cz * r)) wet = r;
    else {
      dry = r;
      break;
    }
  }
  // A ray that never leaves the water is clamped to the basin's own bound; the predicate
  // cannot produce this, and reporting the bound is more honest than inventing a shore.
  if (dry === null) return wet > 0 ? maxRadius : 0;
  let lo = wet,
    hi = dry;
  for (let i = 0; i < BISECTIONS; i++) {
    const mid = (lo + hi) / 2;
    if (isWet(cx * mid, cz * mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

// The full outline at a given basin level, as one radius per spoke. `isWet` defaults to the
// movement predicate itself so the two can never drift apart.
export function pondOutline(
  level,
  {
    spokes = POND_SPOKES,
    rings = POND_RINGS,
    maxRadius = POND_MAX_RADIUS,
    isWet = (x, z) => !!waterAt(x, z, level),
  } = {},
) {
  const radii = new Float64Array(spokes);
  for (let s = 0; s < spokes; s++)
    radii[s] = pondShoreRadius(isWet, (s / spokes) * Math.PI * 2, maxRadius);
  return { spokes, rings, radii };
}
