// Locomotion Zero, stage 2: one coherent input/orientation authority.
//
// The property that matters is that grouping the same fixed steps into different
// render frames cannot change where Squirtle ends up. Look used to be consumed by
// the renderer, so a frame that ran several steps steered all of them with one
// obsolete heading - and a hitch could drop a whole drag. The simulation owns look
// now, and each step takes its share.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Input } from "../src/input.js";
import { Loop } from "../src/loop.js";
import { CreatureCamera, PITCH_LIMITS } from "../src/player/creature-camera.js";
import { createBody } from "../src/player/body-state.js";
import { stepBody } from "../src/player/squirtle-controller.js";

const flat = {
  sample: () => ({ height: 0, dx: 0, dz: 0 }),
  water: () => null,
  obstacles: [],
};
const SETTINGS = { sensitivity: 1, invertY: false, reducedMotion: false };

// A ledger-only Input: the accumulator and its arithmetic are what is under test,
// and they must not depend on a browser event having fired first.
function ledger(lookX = 0, lookY = 0) {
  const fake = Object.create(Input.prototype);
  fake.lookX = lookX;
  fake.lookY = lookY;
  return fake;
}

// The exact pipeline src/main.js runs per fixed step, so a wiring mistake here is
// a wiring mistake there.
function rigFor() {
  const rig = new CreatureCamera(
    new THREE.PerspectiveCamera(55, 1.5, 0.04, 100),
    flat,
  );
  rig.yaw = 0;
  rig.pitch = 0;
  return rig;
}
function makeStep(body, rig, lookPerStep, inputPerStep) {
  let step = 0;
  return (dt) => {
    const look = lookPerStep[step] ?? { x: 0, y: 0 };
    if (look.x || look.y) rig.applyLook(look, SETTINGS);
    stepBody(body, inputPerStep[step] ?? { x: 0, z: 0 }, flat, dt);
    step++;
  };
}

test("look shares sum to the pending drag exactly, once", () => {
  const input = ledger(30, -12);
  let taken = { x: 0, y: 0 };
  // A frame that ran four steps: each takes a quarter of what is still pending.
  for (let remaining = 4; remaining > 0; remaining--) {
    const share = input.takeLook(remaining);
    taken.x += share.x;
    taken.y += share.y;
  }
  assert.ok(Math.abs(taken.x - 30) < 1e-9, `x consumed ${taken.x}`);
  assert.ok(Math.abs(taken.y + 12) < 1e-9, `y consumed ${taken.y}`);
  const leftover = input.pendingLook();
  assert.equal(leftover.x, 0);
  assert.equal(leftover.y, 0);
});

test("a frame with no simulation step consumes nothing", () => {
  // 120 Hz rendering runs frames that step zero times. `takeLook` is only ever
  // called from a step, so pending drag has to survive untouched in between.
  const input = ledger();
  let steps = 0;
  const loop = new Loop((dt, index, count) => {
    steps++;
    input.takeLook(count - index);
  }, () => {});
  input.lookX = 8;
  const quarter = 1000 / 240; // a display faster than the simulation step
  loop.frame(0);
  loop.frame(quarter);
  loop.frame(quarter * 2);
  loop.frame(quarter * 3);
  assert.equal(steps, 0, "a step-less frame must not touch the look ledger");
  assert.equal(input.pendingLook().x, 8, "unapplied look has to wait, not vanish");
  loop.frame(quarter * 4); // a full step is now owed
  assert.equal(steps, 1);
  assert.equal(input.pendingLook().x, 0);
});

// The same drag, grouped into render frames of different sizes. `perStep` values
// are what a 125 Hz mouse delivers to a 60 Hz simulation; a coarser frame has to
// hand each of its steps the share it would have had, so the path is identical.
function groupRun(turns, frameSize) {
  const body = createBody(0, 0, 0);
  body.yaw = 0;
  const rig = rigFor(),
    input = ledger();
  const perStep = [];
  let step = 0;
  for (let i = 0; i < turns.length; i += frameSize) {
    const total = turns
      .slice(i, i + frameSize)
      .reduce((a, t) => ({ x: a.x + t.x, y: a.y + t.y }), { x: 0, y: 0 });
    input.lookX = total.x;
    input.lookY = total.y;
    const size = Math.min(frameSize, turns.length - i);
    for (let index = 0; index < size; index++) {
      const look = input.takeLook(size - index);
      if (look.x || look.y) rig.applyLook(look, SETTINGS);
      perStep.push(rig.yaw);
      stepBody(body, { x: 0, z: 1 }, flat, 1 / 60);
      step++;
    }
  }
  return { body, rig, input, perStep, steps: step };
}

test("grouping the same steps into bigger frames cannot change the path", () => {
  const turns = Array.from({ length: 60 }, () => ({ x: 2, y: 0 }));
  const reference = groupRun(turns, 1);
  for (const frameSize of [2, 3, 4, 6]) {
    const other = groupRun(turns, frameSize);
    assert.equal(other.steps, reference.steps);
    assert.ok(
      Math.abs(other.rig.yaw - reference.rig.yaw) < 1e-9,
      `${frameSize} steps/frame ended ${other.rig.yaw} rad from steady 60 Hz`,
    );
    assert.ok(
      Math.hypot(other.body.x - reference.body.x, other.body.z - reference.body.z) <
        1e-9,
      `${frameSize} steps/frame moved to a different place`,
    );
    // Every step turns: none of them is left steering with the pre-frame heading.
    for (let i = 1; i < other.perStep.length; i++)
      assert.ok(
        other.perStep[i] !== other.perStep[i - 1],
        `${frameSize} steps/frame repeated a stale heading at step ${i}`,
      );
    assert.deepEqual(other.perStep.map((y) => +y.toFixed(9)), reference.perStep.map((y) => +y.toFixed(9)));
  }
  assert.ok(reference.rig.yaw < -0.4, "the turn has to actually have happened");
});

test("a hitch mid-turn applies every pixel of look, exactly once", () => {
  const body = createBody(0, 0, 0);
  const rig = rigFor();
  const input = ledger();
  let pushed = 0,
    applied = 0;
  const headings = [];
  const loop = new Loop((dt, index, count) => {
    // 40 px of look arrive before the first step the hitch runs, as they would
    // from a continuous drag the renderer never got to sample.
    if (index === 0) {
      input.lookX += 40;
      pushed += 40;
    }
    const share = input.takeLook(count - index);
    if (share.x) {
      applied += share.x;
      rig.applyLook(share, SETTINGS);
    }
    headings.push(rig.yaw);
    stepBody(body, { x: 0, z: 1 }, flat, dt);
  }, () => {});
  loop.frame(0);
  loop.frame(150); // nine steps, one consumption of the drag
  assert.ok(Math.abs(applied - pushed) < 1e-9, "look was double-counted or dropped");
  assert.ok(Math.abs(rig.yaw - -40 * 0.004) < 1e-9, `yaw ${rig.yaw}`);
  assert.equal(input.pendingLook().x, 0);
  assert.equal(headings.length, 9);
  assert.ok(
    new Set(headings.map((h) => h.toFixed(6))).size === 9,
    "the steps after a hitch must not all steer with one stale heading",
  );
});

test("rapid 90 degree turn reaches the heading the drag asked for", () => {
  const rig = rigFor();
  // 90 degrees of yaw is 0.5 * sensitivity, per the documented 0.004 rad/px scale.
  rig.applyLook({ x: Math.PI / 2 / 0.004, y: 0 }, SETTINGS);
  assert.ok(Math.abs(Math.abs(rig.yaw) - Math.PI / 2) < 1e-9, `yaw ${rig.yaw}`);
  const sensitive = rigFor();
  sensitive.applyLook({ x: 10, y: 0 }, { ...SETTINGS, sensitivity: 2 });
  assert.ok(Math.abs(sensitive.yaw - 2 * -0.04) < 1e-9, "sensitivity ignored");
});

test("pitch respects inversion, and clamps instead of running away", () => {
  const start = rigFor().pitch;
  const down = rigFor();
  down.applyLook({ x: 0, y: 20 }, SETTINGS);
  const inverted = rigFor();
  inverted.applyLook({ x: 0, y: 20 }, { ...SETTINGS, invertY: true });
  // Same distance, other direction, mirrored about the starting pitch.
  assert.ok(
    Math.abs(down.pitch - start - (start - inverted.pitch)) < 1e-12,
    `invert Y moved ${down.pitch - start} against ${inverted.pitch - start}`,
  );
  assert.ok(down.pitch > start && inverted.pitch < start);
  const beyond = rigFor();
  beyond.applyLook({ x: 0, y: 5000 }, SETTINGS);
  assert.equal(beyond.pitch, PITCH_LIMITS.max, "pitch must stop at the limit");
  beyond.applyLook({ x: 0, y: 5000 }, SETTINGS);
  assert.equal(beyond.pitch, PITCH_LIMITS.max, "a clamped axis must not accumulate");
  const floor = rigFor();
  floor.applyLook({ x: 0, y: -5000 }, SETTINGS);
  assert.equal(floor.pitch, PITCH_LIMITS.min);
});

test("movement direction follows the live heading, not a remembered one", () => {
  const rig = rigFor();
  const before = rig.movement(0, 1);
  rig.applyLook({ x: Math.PI / 2 / 0.004, y: 0 }, SETTINGS); // 90 degrees
  const after = rig.movement(0, 1);
  assert.ok(Math.abs(before.z - 1) < 1e-9 && Math.abs(before.x) < 1e-9);
  // A quarter turn must hand the sideways axis over to the forward one.
  assert.ok(Math.abs(after.x - -1) < 1e-9, `x ${after.x}`);
  assert.ok(Math.abs(after.z) < 1e-9, `z ${after.z}`);
  assert.equal(rig.heading(), rig.yaw, "heading must be the yaw movement consumes");
});

test("render-only effects cannot steer the body", () => {
  const rig = rigFor();
  const body = createBody(0, 0, 0);
  body.impact = 0.5; // hard landing: micro-recoil
  body.mode = "slide";
  body.vx = 5; // slide: FOV kick and look-ahead
  const yaw = rig.yaw,
    pitch = rig.pitch;
  rig.update(body, 1 / 60, { ...SETTINGS, reducedMotion: false });
  assert.ok(rig.impactRecoil > 0, "recoil should have fired as presentation");
  assert.ok(rig.camera.fov > 55, "FOV should have widened as presentation");
  assert.equal(rig.yaw, yaw, "recoil must not move the heading");
  assert.equal(rig.pitch, pitch, "FOV must not move the aim");
  assert.equal(rig.movement(0, 1).z, 1, "movement authority unchanged by effects");
});

test("look is cleared on focus loss and pointer cancellation", async () => {
  const previous = globalThis.document;
  globalThis.document = { querySelector: () => null };
  try {
    const input = ledger(12, -5);
    input.pointers = new Map();
    input.keys = new Set();
    input.actions = {};
    input.stick = { x: 0, z: 0 };
    input.clear();
    const pending = input.pendingLook();
    assert.equal(pending.x, 0);
    assert.equal(pending.y, 0);
    assert.equal(input.stick.x, 0, "movement stick must release too");
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});

test("touch stick and look coexist without cross-contamination", async () => {
  const input = ledger(0, 0);
  input.stick = { x: 0.5, z: 0.5 };
  input.keys = new Set();
  input.actions = {};
  input.lookX = 7;
  input.lookY = -3;
  const move = { x: input.stick.x, z: input.stick.z };
  const look = input.takeLook(1);
  assert.deepEqual(move, { x: 0.5, z: 0.5 }, "stick must survive as movement intent");
  assert.deepEqual(look, { x: 7, y: -3 }, "drag must arrive as look, unsplit");
});
