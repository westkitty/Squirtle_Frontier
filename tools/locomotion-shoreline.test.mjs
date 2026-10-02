// Locomotion Zero, stage 3: the shoreline as a state machine.
//
// Every case here walks the body physically - no teleporting into a state and
// asserting the label - because the bug being repaired was a *transition*: leaving
// the water routed through `air` for a step, and shallow water did not exist as a
// state at all. Traversals are repeated so a one-off ordering cannot pass.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBody } from "../src/player/body-state.js";
import { stepBody } from "../src/player/squirtle-controller.js";
import {
  MODES,
  SHORE,
  depthBands,
  resolveShoreMode,
  shoreReading,
  withSubmersion,
} from "../src/player/locomotion-states.js";
import { sampleGround, waterAt } from "../src/player/movement-region.js";
import { WATER_BASE } from "../src/simulation/water-level.js";
import {
  labRegion,
  labHeight,
  LAB_WATER_R,
  LAB_WATER_LEVEL,
  LAB_SHELF_R,
  LAB_FLOOR,
} from "../src/player/habitat-view.js";

const DT = 1 / 60;
const frontier = (level = WATER_BASE) => ({
  sample: sampleGround,
  water: (x, z) => waterAt(x, z, level),
  obstacles: [],
});
const controls = (extra = {}) => ({
  x: 0,
  z: 0,
  run: false,
  slide: false,
  jet: false,
  dive: false,
  ascend: false,
  ...extra,
});

// Walk the body along a heading and record every state it passes through.
function traverse(body, env, input, steps = 900) {
  const seen = [body.mode];
  for (let i = 0; i < steps; i++) {
    stepBody(body, input, env, DT);
    if (seen[seen.length - 1] !== body.mode) seen.push(body.mode);
  }
  return seen;
}
// Drive until a state is reached, and fail with the whole path if it is not: the
// traversals drift by a little each round, so pinning step counts would test the
// fixture rather than the state machine.
function walkTo(body, env, input, target, maxSteps = 900) {
  const seen = [body.mode];
  for (let i = 0; i < maxSteps; i++) {
    stepBody(body, input, env, DT);
    if (seen[seen.length - 1] !== body.mode) seen.push(body.mode);
    if (body.mode === target) return seen;
  }
  throw new assert.AssertionError({
    message: `never reached ${target}: ${seen.join(" -> ")}`,
  });
}

test("walking into the pond passes through wading before it floats", () => {
  const env = frontier();
  // Start on dry bank east of the shallows, heading inward (yaw 0 faces +z, so
  // heading -x means facing -x: atan2(x, z) with x = -1).
  const body = createBody(7.5, 18, sampleGround(7.5, 18).height);
  const seen = traverse(body, env, controls({ x: -1 }), 700);
  assert.ok(seen.includes(MODES.WADE), `no wading state: ${seen.join(" -> ")}`);
  assert.ok(seen.includes(MODES.SWIM), `never floated: ${seen.join(" -> ")}`);
  assert.ok(
    seen.indexOf(MODES.WADE) < seen.indexOf(MODES.SWIM),
    `wading has to come first: ${seen.join(" -> ")}`,
  );
  assert.ok(!seen.includes(MODES.AIR), `air appeared on entry: ${seen.join(" -> ")}`);
});

test("an ordinary swim exit grounds through wading, never through air", () => {
  const env = frontier();
  // Eight continuous round trips across the same bank: the exit is what used to
  // flash `air`, so it is exercised over and over rather than once.
  const body = createBody(7.5, 18, sampleGround(7.5, 18).height);
  const in$ = controls({ x: -1 });
  const out$ = controls({ x: 1 });
  for (const round of Array.from({ length: 8 }, (_, i) => i)) {
    const inward = walkTo(body, env, in$, MODES.SWIM);
    assert.ok(
      !inward.includes(MODES.AIR),
      `round ${round} entered the water through air: ${inward.join(" -> ")}`,
    );
    const outward = walkTo(body, env, out$, MODES.LAND);
    assert.ok(
      outward.includes(MODES.WADE),
      `round ${round} left the water without wading: ${outward.join(" -> ")}`,
    );
    assert.ok(
      !outward.includes(MODES.AIR),
      `round ${round} routed a shore exit through air: ${outward.join(" -> ")}`,
    );
  }
});

// A swimmer heading for the bank has to keep grounding out through shallows, so the
// starting height comes from the same measurement the body uses.
function LAB_DEPTH_FREE(env, x, z) {
  const water = env.water(x, z);
  const floor = env.sample(x, z).height;
  return water ? water.level - SHORE.surfaceFloat : floor;
}

test("wading keeps the body on the ground and resists it", () => {
  const env = frontier();
  const body = createBody(5.7, 18, 0);
  // Nudge until the reading lands in the wade band, then hold a step steady.
  let waded = 0,
    ungrounded = 0,
    floating = 0;
  for (let i = 0; i < 240; i++) {
    stepBody(body, controls({ x: -1 }), env, DT);
    if (body.mode === MODES.WADE) {
      waded++;
      if (!body.grounded) ungrounded++;
      // Standing on the bottom, not held up by the surface.
      if (body.y > env.sample(body.x, body.z).height + 0.02) floating++;
    }
  }
  assert.ok(waded > 8, `barely waded at all (${waded} steps)`);
  assert.equal(ungrounded, 0, "wading must stay grounded");
  assert.equal(floating, 0, "a wading body must not float on the surface");
  // Resistance: the same drive covers less ground wet than dry.
  const wet = createBody(5.7, 18, body.y);
  wet.mode = MODES.WADE;
  const dry = createBody(0, 0, 0);
  for (let i = 0; i < 60; i++) {
    stepBody(wet, controls({ z: 1, run: true }), wadeOnly(), DT);
    stepBody(dry, controls({ z: 1, run: true }), flatEnv(), DT);
  }
  assert.ok(
    Math.hypot(wet.vx, wet.vz) < Math.hypot(dry.vx, dry.vz),
    `wade speed ${Math.hypot(wet.vx, wet.vz)} is not slower than land ${Math.hypot(dry.vx, dry.vz)}`,
  );
});

const flatEnv = () => ({
  sample: () => ({ height: 0, dx: 0, dz: 0 }),
  water: () => null,
  obstacles: [],
});
const wadeOnly = () => ({
  sample: () => ({ height: -0.2, dx: 0, dz: 0 }),
  water: () => ({ level: 0, currentX: 0, currentZ: 0 }),
  obstacles: [],
});

test("dive is intentional, and returns to the surface state", () => {
  const env = frontier();
  const body = createBody(0, 18, LAB_DEPTH_FREE(env, 0, 18));
  body.mode = MODES.SWIM;
  traverse(body, env, controls(), 30);
  assert.equal(body.mode, MODES.SWIM, "simply being deep must not start a dive");
  const seen = traverse(body, env, controls({ dive: true }), 60);
  assert.ok(seen.includes(MODES.DIVE), `dive never entered: ${seen.join(" -> ")}`);
  assert.ok(body.y < env.water(body.x, body.z).level - SHORE.surfaceFloat - 0.2);
  const back = traverse(body, env, controls({ ascend: true }), 240);
  assert.ok(back.includes(MODES.SWIM), `never surfaced: ${back.join(" -> ")}`);
  assert.ok(!back.includes(MODES.AIR), "surfacing is not a launch");
});

test("an intentional launch still leaves the water as air", () => {
  const env = frontier();
  const body = createBody(0, 18, LAB_DEPTH_FREE(env, 0, 18));
  body.mode = MODES.SWIM;
  const seen = [];
  for (let i = 0; i < 120; i++) {
    const input = controls({ jet: i === 0 });
    stepBody(body, input, env, DT);
    if (!seen.length || seen[seen.length - 1] !== body.mode) seen.push(body.mode);
  }
  assert.ok(seen.includes(MODES.AIR), `a breach is air: ${seen.join(" -> ")}`);
  assert.ok(
    !seen.includes(MODES.WADE) || seen.indexOf(MODES.AIR) < seen.indexOf(MODES.WADE),
    "a breach must not be grounded out as shallows first",
  );
});

test("hysteresis holds a state while the reading sits inside the band", () => {
  // The water level breathes by a centimetre either side of the wade/swim boundary:
  // exactly the input that made the old single-threshold rule flicker.
  const env = (offset) => ({
    sample: () => ({ height: -SHORE.swimEnter - offset, dx: 0, dz: 0 }),
    water: () => ({ level: 0, currentX: 0, currentZ: 0 }),
    obstacles: [],
  });
  const modes = new Set();
  const body = createBody(0, 0, -SHORE.swimEnter - 0.02);
  for (let i = 0; i < 240; i++) {
    const wobbling = env(Math.sin(i * 0.7) * 0.01);
    stepBody(body, controls(), wobbling, DT);
    modes.add(body.mode);
  }
  assert.equal(modes.size, 1, `state chattered across ${[...modes].join(",")}`);
  const bands = depthBands(MODES.SWIM, SHORE.swimExit + 0.005);
  assert.equal(bands.afloat, true, "inside the exit band a swimmer stays afloat");
  assert.equal(depthBands(MODES.LAND, SHORE.wadeEnter - 0.005).wet, false);
  assert.equal(
    resolveShoreMode(MODES.SWIM, { wet: true, afloat: false, submersion: 0.05 }),
    MODES.WADE,
    "a grounded-out swimmer becomes a wader, not an airborne body",
  );
});

test("depth is terrain-relative, so a lifted pond lifts the states", () => {
  // Same body height, but the whole water column sits above sea level: any rule that
  // compared `y < 0` would call this dry ground.
  const high = {
    sample: () => ({ height: 4.2, dx: 0, dz: 0 }),
    water: () => ({ level: 5, currentX: 0, currentZ: 0 }),
    obstacles: [],
  };
  const body = createBody(0, 0, 4.85);
  assert.ok(body.y > 0, "the body is well above the origin plane");
  const reading = withSubmersion(shoreReading(high, 0, 0), body.y);
  assert.ok(reading.inWater && reading.depth > 0.1);
  traverse(body, high, controls(), 30);
  assert.equal(body.mode, MODES.SWIM, "a positive-height surface must still float");
  assert.ok(body.y < 5, "the body floats at the lifted surface, not at zero");
});

test("a shoal rising under a swimmer grounds the body out", () => {
  let rise = 0;
  const shoal = {
    sample: (x, z) => ({ height: -0.6 + (rise += 1 / 6000), dx: 0, dz: 0 }),
    water: () => ({ level: 0, currentX: 0, currentZ: 0 }),
    obstacles: [],
  };
  const body = createBody(0, 0, -0.18);
  body.mode = MODES.SWIM;
  const seen = traverse(body, shoal, controls(), 600);
  assert.ok(seen.includes(MODES.WADE), `no grounding state as the floor rose: ${seen}`);
  assert.ok(!seen.includes(MODES.AIR), "a rising floor is not a launch");
});

test("frontier shorelines move with the water level, in order, at every level", () => {
  const levels = [WATER_BASE - 0.04, WATER_BASE, WATER_BASE + 0.28];
  let previousWetEdge = -Infinity;
  for (const level of levels) {
    const env = frontier(level);
    // Walk outward from the pond centre and find where the body stops being wet.
    let wetEdge = 0;
    const body = createBody(0, 18, LAB_DEPTH_FREE(env, 0, 18));
    const seen = [];
    for (let i = 0; i < 1400; i++) {
      stepBody(body, controls({ x: 1, run: true }), env, DT);
      if (!seen.length || seen[seen.length - 1] !== body.mode) seen.push(body.mode);
      if (body.mode !== MODES.LAND) wetEdge = Math.max(wetEdge, body.x);
      if (body.x > 9) break;
    }
    assert.ok(
      seen.includes(MODES.WADE),
      `level ${level}: no wading on the way out: ${seen.join(" -> ")}`,
    );
    assert.ok(
      !seen.includes(MODES.AIR),
      `level ${level}: shore exit went through air: ${seen.join(" -> ")}`,
    );
    assert.equal(body.mode, MODES.LAND, `level ${level}: never reached dry ground`);
    assert.ok(
      wetEdge > previousWetEdge,
      `a higher level has to wet more ground (${wetEdge} vs ${previousWetEdge})`,
    );
    previousWetEdge = wetEdge;
  }
});

test("the Listening Basin profile is gentle and its waterline is derived", () => {
  let maxSlope = 0;
  for (let d = 0; d < LAB_SHELF_R + 0.5; d += 0.01)
    maxSlope = Math.max(
      maxSlope,
      Math.abs((labHeight(d + 0.01, 0) - labHeight(d, 0)) / 0.01),
    );
  // The replaced profile was 1.556 (a 57 degree wall); the body only follows unit
  // gradients, so anything at or above 1.0 is an exception rather than a shore.
  assert.ok(maxSlope < 1.0, `basin still has a wall in it: gradient ${maxSlope}`);
  assert.ok(maxSlope < 1.556 / 2, `not substantially gentler: ${maxSlope}`);
  assert.equal(labHeight(0, 0), LAB_FLOOR, "the shaft mouth keeps its floor");
  assert.equal(labHeight(LAB_SHELF_R, 0), 0, "the rim has to be dry ground");
  // Rendered geometry and physics authority are the same number by construction.
  assert.ok(
    Math.abs(labHeight(LAB_WATER_R, 0) - LAB_WATER_LEVEL) < 1e-6,
    "the painted disc edge must sit exactly on the floor it meets",
  );
  assert.ok(labRegion.water(LAB_WATER_R - 0.05, 0), "just inside the waterline is wet");
  assert.equal(labRegion.water(LAB_WATER_R + 0.05, 0), null, "outside is dry");
  const depth = LAB_WATER_LEVEL - LAB_FLOOR;
  assert.ok(depth > SHORE.swimEnter, "the pool has to be deep enough to float in");
  // And a wade band has to exist at all: some radius where depth is inside the band.
  let band = 0;
  for (let d = 0; d < LAB_SHELF_R; d += 0.01) {
    const value = LAB_WATER_LEVEL - labHeight(d, 0);
    if (value > SHORE.wadeEnter && value < SHORE.swimEnter) band += 0.01;
  }
  assert.ok(band > 0.2, `the basin has no shallows to wade in (${band} m)`);
});

test("the Lab shoreline reads in order from every side, and can be climbed out of", () => {
  for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    const body = createBody(cos * (LAB_SHELF_R - 0.4), sin * (LAB_SHELF_R - 0.4), 0);
    // Head for the centre, then turn around and climb out.
    const inward = walkTo(
      body,
      labRegion,
      // Inward is toward the origin, so the drive vector is the negative radius.
      controls({ x: -cos, z: -sin, run: true }),
      MODES.SWIM,
      400,
    );
    assert.ok(inward.includes(MODES.WADE), `${angle}: no wade on entry: ${inward}`);
    assert.ok(inward.includes(MODES.SWIM), `${angle}: never swam: ${inward}`);
    assert.ok(!inward.includes(MODES.AIR), `${angle}: entry went through air`);
    const outward = walkTo(
      body,
      labRegion,
      controls({ x: cos, z: sin, run: true }),
      MODES.LAND,
      600,
    );
    assert.ok(
      !outward.includes(MODES.AIR),
      `${angle}: leaving the basin routed through air: ${outward.join(" -> ")}`,
    );
  }
});

test("slide ends when the shell hits the water instead of extending down the bank", () => {
  const env = frontier();
  const body = createBody(9, 18, sampleGround(9, 18).height);
  body.yaw = -Math.PI / 2;
  const seen = traverse(body, env, controls({ slide: true, x: -1 }), 500);
  assert.ok(seen.includes(MODES.SLIDE), `never slid: ${seen.join(" -> ")}`);
  assert.ok(seen.includes(MODES.WADE), `water did not end the slide: ${seen}`);
  assert.equal(
    seen.indexOf(MODES.WADE) > seen.indexOf(MODES.SLIDE),
    true,
    "the shallows come after the slide",
  );
});
