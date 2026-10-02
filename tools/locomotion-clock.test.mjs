// Locomotion Zero, stage 1: the fixed-step clock must not lose time, and the
// renderer must show a pose interpolated between authoritative states.
//
// Every cadence below drives the real `Loop` with synthetic frame timestamps and
// the real 60 Hz body step, so the property under test is the one the player
// actually depends on: the same simulation time has to produce the same movement,
// whether the display is managing 30 frames a second or 120.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Loop,
  FIXED_DT,
  MAX_STEPS,
  MAX_ACCUMULATOR,
} from "../src/loop.js";
import { createBody } from "../src/player/body-state.js";
import { stepBody } from "../src/player/squirtle-controller.js";
import {
  interpolatedPose,
  resetPose,
  shortestAngle,
  MAX_INTERPOLATE_DISTANCE,
} from "../src/player/render-pose.js";

const flat = {
  sample: () => ({ height: 0, dx: 0, dz: 0 }),
  water: () => null,
  obstacles: [],
};
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

// Cadences are sequences of per-frame durations, all covering the same wall-clock
// budget: comparing runs of different lengths would prove nothing about cadence.
const BUDGET_MS = 2000;
function timestamps(spacings) {
  const times = [0];
  let t = 0;
  for (const ms of spacings) {
    if (t + ms > BUDGET_MS * 1.02) break;
    t += ms;
    times.push(t);
  }
  return times;
}
// Jitter is a property of real frames, and a test that only checks tidy intervals
// proves nothing about untidy ones. This generator is seeded, so failures reproduce.
function jittered(seed = 7, ms = 2.4) {
  const spacings = [];
  let state = seed;
  while (state !== 0 && spacings.length < ms * 60) {
    state = (Math.imul(state, 1103515245) + 12345) & 0x7fffffff;
    spacings.push((state / 0x7fffffff) * 26 + 4); // 4 - 30 ms
  }
  return spacings;
}
function hitched(every = 8, ms = 2.4) {
  const spacings = [];
  for (let i = 0; i < ms * 60; i++)
    // A 70 - 150 ms stall every eighth frame: the case the old 100 ms clamp ate.
    spacings.push(i % every === every - 1 ? 70 + ((i * 13) % 81) : 1000 / 60);
  return spacings;
}

function drive(spacings, input = controls({ z: 1, run: true })) {
  const body = createBody(0, 0, 0);
  body.yaw = 0;
  return driveTimestamps(timestamps(spacings), input, body);
}
function driveTimestamps(times, input = controls({ z: 1, run: true }), body = createBody(0, 0, 0)) {
  body.yaw = 0;
  const loop = new Loop(
    (dt) => stepBody(body, input, flat, dt),
    () => {},
  );
  for (const ms of times) loop.frame(ms);
  return { body, loop };
}

test("movement is cadence-independent across 30/60/120/irregular render rates", () => {
  const runs = [
    drive(Array.from({ length: 200 }, () => 1000 / 30)),
    drive(Array.from({ length: 400 }, () => 1000 / 60)),
    drive(Array.from({ length: 400 }, () => 1000 / 120)),
    drive(jittered()),
    drive(hitched()),
  ];
  const reference = runs[1]; // steady 60 Hz
  for (const [index, run] of runs.entries()) {
    // Same wall-clock budget in, same simulation time out - within one step.
    assert.ok(
      Math.abs(run.loop.steps - reference.loop.steps) <= 1,
      `cadence ${index} stepped ${run.loop.steps}, steady 60 Hz stepped ${reference.loop.steps}`,
    );
    assert.equal(
      run.loop.discarded,
      0,
      `cadence ${index} threw away ${run.loop.discarded}s of frame time`,
    );
    const drift = Math.hypot(
      run.body.z - reference.body.z,
      run.body.x - reference.body.x,
    );
    // One step at this speed is ~6 cm; anything larger is a cadence artifact.
    assert.ok(
      drift < 0.07,
      `cadence ${index} diverged by ${drift.toFixed(4)} m of movement`,
    );
    assert.ok(
      Math.abs(run.loop.simTime - reference.loop.simTime) <= FIXED_DT + 1e-9,
      `cadence ${index} simulated ${run.loop.simTime}s against ${reference.loop.simTime}s`,
    );
  }
  assert.ok(reference.body.z > 6, "the reference run barely moved at all");
});

test("a 150 ms hitch is simulated, not skipped", () => {
  const { loop } = driveTimestamps([0, 150]);
  assert.equal(loop.steps, 9, "150 ms is nine fixed steps of simulation");
  assert.equal(loop.discarded, 0);
  assert.ok(Math.abs(loop.simTime - 0.15) < 1e-9);
  // The same hitch arriving mid-run costs nothing either way.
  const mid = drive(hitched(8));
  assert.equal(mid.loop.lastSteps <= 9, true, "one frame never runs the whole hitch");
  assert.equal(mid.loop.discarded, 0);
});

test("simulation work per frame is bounded and the remainder is retained", () => {
  const body = createBody(0, 0, 0);
  const loop = new Loop(
    (dt) => stepBody(body, controls({ z: 1 }), flat, dt),
    () => {},
  );
  // A five second stall is a tab restore: bounded work, and the loss is recorded.
  loop.frame(0);
  loop.frame(5000);
  assert.equal(loop.lastSteps, MAX_STEPS, "one frame may not run the whole backlog");
  assert.ok(loop.accumulator > 0.03, `retained debt was ${loop.accumulator}`);
  const retained = loop.accumulator;
  const lost = loop.discarded;
  assert.ok(lost > 4, `the stall should account its loss, saw ${lost}`);
  // The retained debt is repaid by later frames, and no further time disappears.
  for (let i = 1; i <= 20; i++) loop.frame(5000 + i * (1000 / 60));
  assert.equal(loop.discarded, lost, "catching up must not discard more time");
  assert.ok(loop.accumulator < retained);
  // The accounting identity: everything measured is either simulated, still owed,
  // or explicitly discarded. There is no fourth bucket where frames used to vanish.
  assert.ok(
    Math.abs(
      loop.simTime + loop.discarded + loop.accumulator - loop.realTime,
    ) < 1e-6,
    `sim ${loop.simTime} + lost ${loop.discarded} + owed ${loop.accumulator} != real ${loop.realTime}`,
  );
});

test("slow but recoverable cadence catches up without losing elapsed time", () => {
  const body = createBody(0, 0, 0);
  const loop = new Loop(
    (dt) => stepBody(body, controls({ z: 1 }), flat, dt),
    () => {},
  );
  // 25 ms frames: 1.5 steps each, so half the frames must carry the leftover.
  for (let i = 0; i <= 40; i++) loop.frame(i * 25);
  assert.equal(loop.discarded, 0);
  assert.equal(loop.steps, Math.floor(1000 / 1000 / FIXED_DT), "1 s is 60 steps");
  assert.ok(loop.alpha >= 0 && loop.alpha < 1);
});

test("alpha reports the unapplied remainder and drives a smooth pose", () => {
  const body = createBody(0, 0, 0);
  const loop = new Loop(
    (dt) => stepBody(body, controls({ z: 1, run: true }), flat, dt),
    () => {},
  );
  loop.frame(0);
  loop.frame(FIXED_DT * 1000 * 0.5); // half a step, so no simulation runs
  assert.equal(loop.steps, 0);
  assert.ok(Math.abs(loop.alpha - 0.5) < 1e-6, `alpha was ${loop.alpha}`);
  loop.frame(FIXED_DT * 1000); // crosses the step boundary
  assert.equal(loop.steps, 1);
  assert.ok(loop.alpha < 0.02, `alpha was ${loop.alpha}`);
});

test("interpolated pose spans previous to current without touching the body", () => {
  const body = createBody(0, 0, 0);
  body.yaw = 0;
  const frozen = JSON.stringify(body);
  stepBody(body, controls({ z: 1, run: true }), flat, FIXED_DT);
  assert.notEqual(JSON.stringify(body), frozen, "the step must have moved something");
  const state = JSON.stringify(body);
  const atZero = interpolatedPose(body, 0);
  const atHalf = interpolatedPose(body, 0.5);
  const atOne = interpolatedPose(body, 1);
  assert.equal(JSON.stringify(body), state, "interpolation must not mutate the body");
  assert.notEqual(atOne, body, "the pose is a copy, not the authority");
  assert.ok(atZero.z <= atHalf.z && atHalf.z <= atOne.z, "pose must be monotonic");
  assert.equal(atOne.mode, body.mode, "semantics are copied, never averaged");
  assert.equal(atOne.grounded, body.grounded);
  // Writing to a presentation pose cannot reach the simulation.
  atHalf.x = 999;
  assert.notEqual(body.x, 999);
});

test("yaw takes the short way around, including across the wrap", () => {
  assert.ok(Math.abs(shortestAngle(0.1, 0.2) - 0.1) < 1e-9);
  assert.ok(Math.abs(shortestAngle(3.1, -3.1) - 0.0832) < 1e-3);
  const body = createBody(0, 0, 0);
  body.prevPose.yaw = 3.1;
  body.yaw = -3.1;
  const mid = interpolatedPose(body, 0.5);
  // The short path runs through ±π; the long path would run through 0.
  assert.ok(Math.abs(Math.abs(mid.yaw) - Math.PI) < 0.05, `mid yaw ${mid.yaw}`);
});

test("discontinuities snap the pose instead of sliding across them", () => {
  const body = createBody(0, 0, 0);
  // A teleport: the body is re-authored, then the pose is snapped.
  Object.assign(body, { x: 40, z: -40 });
  assert.ok(
    Math.hypot(body.x - body.prevPose.x, body.z - body.prevPose.z) >
      MAX_INTERPOLATE_DISTANCE,
  );
  assert.equal(interpolatedPose(body, 0).x, 40, "a jump is shown as the new state");
  resetPose(body);
  assert.equal(body.prevPose.x, 40);
  const pose = interpolatedPose(body, 0);
  assert.equal(pose.x, 40);
  assert.equal(pose.z, -40);
});

test("createBody starts with no interpolation error", () => {
  const body = createBody(-10, 18, 1);
  const pose = interpolatedPose(body, 0.37);
  assert.equal(pose.x, -10);
  assert.equal(pose.y, 1);
  assert.equal(pose.z, 18);
  assert.equal(pose.yaw, body.yaw);
});
