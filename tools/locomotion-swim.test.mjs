// Locomotion Zero, stage 4: aquatic steering built around a responsive 3D intent.
//
// Swimming used to be horizontal camera-relative control with separate Q/E vertical
// keys, and the velocity direction answered far more slowly than the body yaw did -
// so Squirtle could visibly face one way while momentum kept going another. These
// cases measure the response instead of asserting a label: time to 50% and 90% of
// a commanded speed, a 90 degree direction change, a stop distance, a surface
// recovery, and the angle between facing and travel while turning.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createBody } from "../src/player/body-state.js";
import { stepBody } from "../src/player/squirtle-controller.js";
import { AQUATIC, MODES, SHORE } from "../src/player/locomotion-states.js";
import { CreatureCamera } from "../src/player/creature-camera.js";
import { sampleGround, waterAt } from "../src/player/movement-region.js";
import { WATER_BASE } from "../src/simulation/water-level.js";

const DT = 1 / 60;
const DEEP = 4; // metres of pond floor under the swimming plane
const pond = (currentX = 0.08, currentZ = -0.18, level = 0) => ({
  sample: () => ({ height: level - DEEP, dx: 0, dz: 0 }),
  water: () => ({ level, currentX, currentZ }),
  obstacles: [],
});
const frontierPond = (level = WATER_BASE) => ({
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
// A rig is the only thing allowed to author intent, so the tests build one and ask
// it the same question src/main.js asks on every fixed step.
function swimRig(yaw = 0, pitch = 0) {
  const rig = new CreatureCamera(
    new THREE.PerspectiveCamera(55, 1.5, 0.04, 100),
    pond(),
  );
  rig.yaw = yaw;
  rig.pitch = pitch;
  return rig;
}
function swimmer(env, x = 0, z = 18, y = -0.2) {
  const body = createBody(x, z, y);
  body.mode = MODES.SWIM;
  body.grounded = false;
  return body;
}
// One fixed-step tick where the camera owns the intent, exactly as in the game.
function tick(body, rig, input, env, seconds = 1) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    const planar = rig ? rig.movement(input.x, input.z) : { x: input.x, z: input.z };
    const intent = rig
      ? rig.intent3(input.x, input.z, 1)
      : { x: input.x, y: 0, z: input.z };
    stepBody(body, { ...input, ...planar, intent }, env, DT);
  }
  return body;
}
// Seconds until a predicate first holds, or Infinity.
function secondsUntil(body, rig, input, env, done, limit = 4) {
  for (let i = 1; i <= limit * 60; i++) {
    tick(body, rig, input, env, DT);
    if (done(body)) return i * DT;
  }
  return Infinity;
}

test("acceleration to commanded speed is measured, not assumed", () => {
  const env = pond();
  const body = swimmer(env);
  const at50 = secondsUntil(body, null, controls({ z: 1 }), env, (b) => Math.hypot(b.vx, b.vz) >= AQUATIC.speed * 0.5);
  const at90 = secondsUntil(body, null, controls({ z: 1 }), env, (b) => Math.hypot(b.vx, b.vz) >= AQUATIC.speed * 0.9);
  assert.ok(at50 <= 0.15, `50% of swim speed took ${at50}s`);
  assert.ok(at90 <= 0.4, `90% of swim speed took ${at90}s`);
  assert.ok(at90 > at50, "the response has to be monotonic");
  // ...and it does keep converging to the commanded speed.
  tick(body, null, controls({ z: 1 }), env, 1);
  // The drive is what should converge on the commanded speed; the current rides on
  // top of it as an environmental offset rather than inflating the stroke.
  const drive = Math.hypot(body.vx - env.water().currentX, body.vz - env.water().currentZ);
  assert.ok(
    Math.abs(drive - AQUATIC.speed) < 0.15,
    `settled drive ${drive.toFixed(2)} vs commanded ${AQUATIC.speed}`,
  );
});

test("a 90 degree direction change settles inside half a second", () => {
  const env = pond();
  const body = swimmer(env);
  body.vz = AQUATIC.speed;
  tick(body, null, controls({ z: 1 }), env, 0.5);
  const error = (b) =>
    Math.abs(Math.atan2(Math.sin(Math.atan2(b.vx, b.vz) - Math.PI / 2), Math.cos(Math.atan2(b.vx, b.vz) - Math.PI / 2)));
  const settle = secondsUntil(body, null, controls({ x: 1 }), env, (b) => error(b) < (10 * Math.PI) / 180, 2);
  assert.ok(settle <= 0.5, `90 degree turn needed ${settle}s to settle within 10 degrees`);
});

test("facing and travel stay coherent through a hard turn", () => {
  // The reported bug: body yaw answered at rate 12 while velocity answered at 3.4,
  // so the model faced a heading its momentum disagreed with for most of a second.
  const env = pond();
  const body = swimmer(env);
  body.vz = AQUATIC.speed;
  body.yaw = 0;
  let worst = 0;
  for (let i = 0; i < 120; i++) {
    tick(body, null, controls({ x: 1 }), env, DT);
    const speed = Math.hypot(body.vx, body.vz);
    if (speed > 0.5) {
      const heading = Math.atan2(body.vx, body.vz);
      worst = Math.max(
        worst,
        Math.abs(Math.atan2(Math.sin(heading - body.yaw), Math.cos(heading - body.yaw))),
      );
    }
  }
  assert.ok(worst < 0.35, `facing led travel by ${((worst * 180) / Math.PI).toFixed(1)} degrees`);
});

test("releasing the stroke coasts instead of stopping on a rail", () => {
  const env = pond();
  const body = swimmer(env);
  tick(body, null, controls({ z: 1 }), env, 1.2);
  const before = { x: body.x, z: body.z };
  const seconds = secondsUntil(body, null, controls(), env, (b) => Math.hypot(b.vx, b.vz) < 0.4, 8);
  const glide = Math.hypot(body.x - before.x, body.z - before.z);
  assert.ok(glide > 1, `the glide was only ${glide.toFixed(2)} m - that is a rail, not inertia`);
  assert.ok(glide < 6, `the glide ran ${glide.toFixed(2)} m - the body never settles`);
  assert.ok(seconds < 4, `coasting took ${seconds}s`);
});

test("camera pitch drives the trajectory up and down", () => {
  const env = pond();
  // Truly under, where looking down is a steering input rather than a suggestion.
  const down = swimmer(env, 0, 18, -2.2);
  down.mode = MODES.DIVE;
  tick(down, swimRig(0, 0.6), controls({ z: 1 }), env, 1);
  assert.ok(down.y < -2.9, `looking down did not sink the diver (y ${down.y.toFixed(2)})`);
  const up = swimmer(env, 0, 18, -2.6);
  up.mode = MODES.DIVE;
  tick(up, swimRig(0, -0.3), controls({ z: 1 }), env, 1.4);
  assert.ok(up.y > -2.4, `looking up did not lift the diver (y ${up.y.toFixed(2)})`);
  // At the surface the same look only wallows: bounded, not a plunge.
  const wallow = swimmer(env);
  tick(wallow, swimRig(0, 0.85), controls({ z: 1 }), env, 2);
  assert.ok(
    env.water().level - wallow.y < 0.6,
    `a surface swim sank to ${(env.water().level - wallow.y).toFixed(2)} m`,
  );
  // And the steepest allowed look must not outrun the explicit Dive key.
  const pitched = swimmer(env, 0, 18, -2.2);
  pitched.mode = MODES.DIVE;
  tick(pitched, swimRig(0, 0.85), controls({ z: 1 }), env, 0.5);
  const dived = swimmer(env, 0, 18, -2.2);
  dived.mode = MODES.DIVE;
  tick(dived, swimRig(0, 0), controls({ z: 1, dive: true }), env, 0.5);
  assert.ok(
    Math.abs(dived.vy) >= Math.abs(pitched.vy) - 1e-9,
    "the explicit control has to remain at least as strong as a look",
  );
  assert.ok(
    Math.hypot(pitched.vx, pitched.vy, pitched.vz) <= AQUATIC.speed * 1.3,
    "3D intent must not inflate total speed",
  );
});

test("Dive and Rise remain strong vertical overrides", () => {
  const env = pond();
  const b = swimmer(env);
  tick(b, null, controls({ dive: true }), env, 0.8);
  assert.equal(b.mode, MODES.DIVE);
  assert.ok(b.vy < -2.3, `dive vertical authority is weak: ${b.vy.toFixed(2)}`);
  const r = swimmer(env);
  r.y = -2.6;
  tick(r, null, controls({ ascend: true }), env, 0.3);
  assert.ok(r.vy > 2.3, `rise authority is weak: ${r.vy.toFixed(2)}`);
  tick(r, null, controls({ ascend: true }), env, 0.6);
  assert.ok(r.y > -1.6, `a strong rise did not climb (${r.y.toFixed(2)})`);
  // An override beats a disagreeing look, and cancels when released.
  const against = swimmer(env);
  against.y = -2.4;
  tick(against, swimRig(0, -0.3), controls({ z: 1, dive: true }), env, 0.5);
  assert.ok(against.vy < 0, "Rise-looking-up must not cancel a held Dive");
});

test("surface swimming resists an accidental descent but recovers deliberately", () => {
  const env = pond();
  // A nosed-down camera at the surface is a wallow, not a plunge.
  const wallow = swimmer(env, 0, 18, -0.2);
  for (let i = 0; i < 240; i++)
    tick(wallow, swimRig(0, 0.45), controls({ z: 1 }), env, DT);
  const submersion = env.water().level - wallow.y;
  assert.ok(
    submersion > 0.1 && submersion < 0.6,
    `a nosed-down surface swim sank to ${submersion.toFixed(2)} m below the surface`,
  );
  // Displaced inside the surface band and released, the body comes back to the
  // float line by itself: that is the whole "resist accidental descent" claim,
  // measured as a recovery time.
  const dive = swimmer(env, 0, 18, -0.2);
  const floor = env.sample().height;
  dive.y = env.water().level - 0.5;
  const displaced = dive.y;
  const recovered = secondsUntil(
    dive,
    swimRig(0, 0),
    controls(),
    env,
    (b) => env.water().level - b.y < SHORE.swimFloat + 0.06,
    5,
  );
  assert.ok(recovered < 1.2, `surface recovery took ${recovered}s`);
  assert.ok(dive.y > displaced, "recovery has to climb, not keep sinking");
  // A dive held long enough to leave the band is a *choice*, and it is undone by
  // the Rise key rather than by an autopilot.
  const long = swimmer(env, 0, 18, -0.2);
  tick(long, swimRig(0, 0), controls({ dive: true }), env, 0.5);
  assert.ok(long.y < -0.7, `an intended dive did not go under (${long.y.toFixed(2)})`);
  tick(long, swimRig(0, 0), controls({ ascend: true }), env, 1.4);
  assert.ok(
    env.water().level - long.y < SHORE.swimFloat + 0.1,
    `Rise did not bring the body back to the surface (${long.y.toFixed(2)})`,
  );
  tick(long, swimRig(0, 0), controls(), env, 1.2);
  assert.ok(Math.abs(dive.vy) < 0.6, `recovery did not settle (vy ${dive.vy.toFixed(2)})`);
  assert.ok(
    Math.abs(env.water().level - SHORE.swimFloat - dive.y) < 0.2,
    `settled at ${dive.y.toFixed(2)} against a float line of ${(env.water().level - SHORE.swimFloat).toFixed(2)}`,
  );
  // From real depth the answer is the Rise key - and it is a strong one. Depth must
  // not be a trap, and it must not auto-pilot the player either: the drift down
  // here is under the Deep Record's settle tolerance on purpose.
  const deep = swimmer(env, 0, 18, floor + 0.3);
  deep.mode = MODES.DIVE;
  const idled = Math.abs(deep.vy);
  tick(deep, swimRig(0, 0), controls(), env, 0.5);
  assert.ok(Math.abs(deep.vy) < 0.6, `an idle diver drifted off at ${deep.vy.toFixed(2)}`);
  assert.ok(idled <= 0.6);
  tick(deep, swimRig(0, 0), controls({ ascend: true }), env, 1);
  assert.ok(deep.y > floor + 1, "Rise has to lift a diver off the bottom");
});

test("currents carry the body without steering it", () => {
  const drifting = swimmer(pond(0.5, 0));
  tick(drifting, null, controls(), pond(0.5, 0), 2);
  assert.ok(drifting.x > 0.6, `a strong current did not drift the body (${drifting.x})`);
  const fighting = swimmer(pond(0.5, 0));
  tick(fighting, null, controls({ x: -1 }), pond(0.5, 0), 1.2);
  assert.ok(
    fighting.vx < -AQUATIC.speed * 0.7,
    `input is not dominant against a 0.5 m/s current (vx ${fighting.vx.toFixed(2)})`,
  );
});

test("Water Jet stays a distinct burst while underwater", () => {
  const env = pond();
  const body = swimmer(env);
  body.yaw = 0;
  tick(body, null, controls({ z: 1 }), env, 0.5);
  const cruising = Math.hypot(body.vx, body.vz);
  stepBody(
    body,
    { ...controls({ jet: true }), x: 0, z: 1, intent: { x: 0, y: 0, z: 1 } },
    env,
    DT,
  );
  assert.ok(body.jetTime > 0.3, "the burst must have a duration");
  assert.ok(body.jetCooldown > 1, "and a cooldown");
  const burst = Math.hypot(body.vx, body.vz);
  assert.ok(burst > cruising, `jet did not add speed (${burst} vs ${cruising})`);
  // Steering authority is withheld for the burst: the velocity vector must turn far
  // less during a jet than the same drive does in ordinary swimming.
  const heading = (b) => Math.atan2(b.vx, b.vz);
  const before = heading(body);
  tick(body, null, controls({ x: 1 }), env, 0.15);
  const duringBurst = Math.abs(heading(body) - before);
  const free = swimmer(env);
  tick(free, null, controls({ z: 1 }), env, 0.6);
  const beforeFree = heading(free);
  tick(free, null, controls({ x: 1 }), env, 0.15);
  const freeTurn = Math.abs(heading(free) - beforeFree);
  assert.ok(
    duringBurst < freeTurn * 0.6,
    `a jet steered ${duringBurst.toFixed(2)} rad against free swim's ${freeTurn.toFixed(2)}`,
  );
  tick(body, null, controls({ z: 1 }), env, 0.5);
  assert.ok(body.jetTime === 0, "the burst has to end");
});

test("body pitch is derived from the trajectory it actually has", () => {
  const env = pond();
  const down = swimmer(env);
  tick(down, null, controls({ dive: true }), env, 0.6);
  assert.ok(down.pitch < -0.2, `diving body pitch ${down.pitch.toFixed(2)}`);
  const flat = swimmer(env);
  tick(flat, null, controls({ z: 1 }), env, 1);
  assert.ok(Math.abs(flat.pitch) < 0.25, `level swimming pitched ${flat.pitch.toFixed(2)}`);
  const climb = swimmer(env);
  climb.y = -2.5;
  tick(climb, null, controls({ ascend: true }), env, 0.5);
  assert.ok(climb.pitch > 0.2, `ascending body pitch ${climb.pitch.toFixed(2)}`);
  for (const b of [down, flat, climb])
    assert.ok(Number.isFinite(b.pitch) && Math.abs(b.pitch) < 1.4, "pitch must stay bounded");
});

test("a continuous journey walks the whole state ladder without teleports", () => {
  // One continuous run: no teleport between phases, only drive and one key. Each
  // phase advances until the state it is aiming for actually appears, so the test
  // follows the world rather than a stopwatch.
  const env = frontierPond();
  const body = createBody(7.5, 18, sampleGround(7.5, 18).height);
  const rig = swimRig(-Math.PI / 2, 0); // facing -x: the pond centre
  const seen = [body.mode];
  const deepest = { y: body.y };
  const step = (input) => {
    const planar = rig.movement(input.x ?? 0, input.z ?? 0);
    const intent = rig.intent3(input.x ?? 0, input.z ?? 0, 1);
    stepBody(body, { ...input, ...planar, intent }, env, DT);
    if (seen[seen.length - 1] !== body.mode) seen.push(body.mode);
    deepest.y = Math.min(deepest.y, body.y);
  };
  const phase = (target, input, maxSeconds = 8) => {
    for (let i = 0; i < maxSeconds * 60 && body.mode !== target; i++) step(input);
    assert.equal(
      body.mode,
      target,
      `phase to ${target} stalled at ${body.mode} (x=${body.x.toFixed(2)}): ${seen.join(" -> ")}`,
    );
  };
  const drive = { x: 0, z: 1, run: true };
  phase(MODES.WADE, drive, 4); // bank into the shallows
  phase(MODES.SWIM, drive, 6); // and float
  phase(MODES.DIVE, { ...drive, dive: true }, 3); // commit under
  // Hold the dive: reaching the state is not the same as using it, and the point of
  // the phase is that the body goes somewhere real in three dimensions.
  for (let i = 0; i < 60; i++) step({ ...drive, dive: true });
  assert.ok(deepest.y < -0.9, `a held dive barely descended (${deepest.y.toFixed(2)})`);
  phase(MODES.SWIM, { ...drive, ascend: true }, 6); // Rise back to the surface
  rig.yaw = Math.PI / 2; // turn about, drive back out
  phase(MODES.LAND, drive, 10);
  assert.ok(
    seen.join(",").includes("wade,swim,dive,swim,wade,land"),
    `ladder not walked in order: ${seen.join(" -> ")}`,
  );
  assert.ok(
    env.water(body.x, body.z) === null,
    "the journey ended in water, not on the bank",
  );
  assert.ok(deepest.y < -0.6, `the dive barely went under (${deepest.y.toFixed(2)})`);
  // Air is only allowed before the water is reached: a step off the bank is air,
  // an ordinary shore exit is not.
  assert.ok(
    !seen.slice(seen.indexOf(MODES.SWIM)).includes(MODES.AIR),
    `air appeared once the body was wet: ${seen.join(" -> ")}`,
  );
});
