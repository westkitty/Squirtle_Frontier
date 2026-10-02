// The shoreline is a state machine, not a comparison.
//
// Locomotion used to decide "am I swimming?" from one expression
// (`y < level + 0.12 && level - floor > 0.4`), which produced three bugs the
// player can feel: there was no shallow-water state at all, walking out of the
// water routed through `air` for a step or two (because grounding lags a single
// term behind the predicate), and a body sitting exactly at a threshold could
// flicker between states as the water level breathed.
//
// Depth here is always *measured* — the active water surface minus the terrain
// under the body — so a rising frontier water level moves the states with it, and
// no region hardcodes `y < 0`. Every boundary is a pair (enter / exit), so a state
// only changes when the reading commits to changing, and the bands never overlap.
export const MODES = Object.freeze({
  LAND: "land",
  WADE: "wade",
  SWIM: "swim",
  DIVE: "dive",
  AIR: "air",
  SLIDE: "slide",
});

export const SHORE = Object.freeze({
  // Metres of water over the ground under the body.
  wadeEnter: 0.06, // dry ground becomes wet
  wadeExit: 0.03, // wading is dry ground again
  swimEnter: 0.34, // a wading body starts to float
  swimExit: 0.24, // a floating body grounds out
  // Metres the body's centre sits below the surface. A dive is entered on intent,
  // so depth only decides when it may *stop*: a floating body rests at
  // `surfaceFloat`, and releasing the key releases the dive once the rise brings
  // the body back inside this band. `diveBelow` is the depth past which a dive has
  // properly left the surface layer, which presentation and 3D steering read.
  diveBelow: 0.44,
  diveAbove: 0.3,
  // A floating body is held this far under the surface, and steered toward it.
  surfaceFloat: 0.18,
  swimFloat: 0.22,
});

export const isWet = (mode) =>
  mode === MODES.WADE || mode === MODES.SWIM || mode === MODES.DIVE;
export const isAquatic = (mode) => mode === MODES.SWIM || mode === MODES.DIVE;
export const isGroundedLocomotion = (mode) =>
  mode === MODES.LAND || mode === MODES.WADE || mode === MODES.SLIDE;

// One authoritative read of the water under a point. `env.water` stays the only
// source of surface level, so dynamic frontier levels, the Lab basin and the Deep
// Record all answer through it.
export function shoreReading(env, x, z) {
  const water = env.water(x, z);
  const floor = env.sample(x, z).height;
  if (!water)
    return {
      inWater: false,
      depth: 0,
      level: floor,
      floor,
      currentX: 0,
      currentZ: 0,
    };
  return {
    inWater: true,
    depth: water.level - floor,
    level: water.level,
    floor,
    currentX: water.currentX ?? 0,
    currentZ: water.currentZ ?? 0,
  };
}

// `submersion` needs the body's height, so it is applied by the caller; the wet /
// afloat decision does not, and stays a pure function of depth.
export function withSubmersion(reading, y) {
  return {
    ...reading,
    submersion: reading.inWater ? reading.level - y : -1,
  };
}

// Thresholds are entered and left at different readings, and `previous` decides
// which side of each pair applies. That is the whole hysteresis mechanism: no
// frame-rate-dependent timer, nothing to reset, and no oscillation inside a band.
export function depthBands(previous, depth) {
  const wet = depth >= (isWet(previous) ? SHORE.wadeExit : SHORE.wadeEnter);
  const afloat =
    depth >= (isAquatic(previous) ? SHORE.swimExit : SHORE.swimEnter);
  return { wet, afloat };
}

// The discrete transition itself. `air` and a jet breach are deliberately not
// decided here: those are consequences of leaving the ground under power, which
// only the integrator can see.
export function resolveShoreMode(previous, context) {
  const { wet, afloat, diving, sliding, submersion = -1 } = context;
  if (!wet) return sliding ? MODES.SLIDE : MODES.LAND;
  // Shell slide is a land behaviour: water ends it rather than extending it.
  if (!afloat) return MODES.WADE;
  // Going under is committed to, not stumbled into: depth alone must not start a
  // dive, or a body resumed mid-pool or swept down a bank would be labelled as
  // diving on its own. Intent enters, and the exit band alone releases it - so a
  // diver who lets go of the key stays under until the buoyant rise gets it back
  // inside `diveAbove`, instead of flipping states mid-ascent.
  if (diving) return MODES.DIVE;
  if (previous === MODES.DIVE && submersion > SHORE.diveAbove) return MODES.DIVE;
  return MODES.SWIM;
}
