import { test } from "node:test";
import assert from "node:assert/strict";
import { createBody } from "../src/player/body-state.js";
import { JET_HOLD_THRESHOLD, stepBody } from "../src/player/squirtle-controller.js";
const input = (extra = {}) => ({
  x: 0,
  z: 0,
  run: false,
  slide: false,
  jet: false,
  dive: false,
  ascend: false,
  ...extra,
});
const flat = {
  sample: () => ({ height: 0, dx: 0, dz: 0 }),
  water: () => null,
  obstacles: [],
};
const pond = {
  sample: () => ({ height: -3, dx: 0, dz: 0 }),
  water: () => ({ level: 0, currentX: 0.08, currentZ: -0.18 }),
  obstacles: [],
};
const tick = (b, i, env, seconds = 1) => {
  for (let j = 0; j < seconds * 60; j++) stepBody(b, i, env, 1 / 60);
  return b;
};
test("run accelerates, exceeds walk, stops with grounded contact", () => {
  const a = createBody(0, 0, 0),
    b = createBody(0, 0, 0);
  tick(a, input({ z: 1 }), flat);
  tick(b, input({ z: 1, run: true }), flat);
  assert.ok(b.vz > a.vz + 1);
  assert.ok(b.z > a.z);
  tick(b, input(), flat);
  assert.ok(Math.abs(b.vz) < 0.01);
  assert.equal(b.y, 0);
});
test("swim/dive/ascent are distinct and current affects idle body", () => {
  const b = createBody(0, 0, -0.22);
  tick(b, input({ z: 1 }), pond);
  assert.equal(b.mode, "swim");
  assert.ok(b.vz > 4);
  tick(b, input({ dive: true }), pond, 0.6);
  assert.equal(b.mode, "dive");
  assert.ok(b.y < -1);
  tick(b, input({ ascend: true }), pond, 1);
  assert.equal(b.mode, "swim");
  const idle = createBody(0, 0, -0.22);
  tick(idle, input(), pond);
  assert.ok(idle.x > 0);
});
test("slide retains momentum, responds to slope and recovers on release", () => {
  const b = createBody(0, 0, 0);
  b.yaw = 0;
  tick(b, input({ slide: true }), flat, 0.5);
  assert.equal(b.mode, "slide");
  assert.ok(b.vz > 1);
  tick(b, input(), flat);
  assert.equal(b.mode, "land");
  assert.ok(Math.abs(b.vz) < 0.01);
  const downhill = {
    ...flat,
    sample: (x, z) => ({ height: -z * 0.1, dx: 0, dz: -0.1 }),
  };
  const c = createBody(0, 0, 0);
  c.yaw = 0;
  tick(c, input({ slide: true }), downhill);
  assert.ok(c.z > 0);
});
test("tap Water Jet bursts on release, is bounded and returns safely to land", () => {
  const b = createBody(0, 0, 0);
  b.yaw = 0;
  stepBody(b, input({ jet: true }), flat, 1 / 60);
  assert.equal(b.jetCooldown, 0, "press alone must not launch before tap/hold intent is known");
  assert.equal(b.jetTime, 0);
  stepBody(b, input(), flat, 1 / 60);
  assert.ok(b.vz > 7);
  assert.ok(b.y > 0);
  assert.ok(b.jetCooldown > 1);
  assert.ok(b.jetTime > 0);
  tick(b, input(), flat, 3);
  assert.equal(b.y, 0);
  assert.equal(b.mode, "land");
});

test("holding Water Jet becomes a camera-aimed hose without traversal launch", () => {
  const b = createBody(0, 0, 0);
  b.yaw = 0;
  const held = input({ jet: true, jetAimX: 1, jetAimY: -0.2, jetAimZ: 0 });
  for (let elapsed = 0; elapsed < JET_HOLD_THRESHOLD + 0.05; elapsed += 1 / 60)
    stepBody(b, held, flat, 1 / 60);
  assert.equal(b.hoseActive, true);
  assert.equal(b.jetCooldown, 0);
  assert.equal(b.jetTime, 0);
  assert.ok(b.yaw > 0.2, "body should visibly turn toward camera hose intent");
  stepBody(b, input(), flat, 1 / 60);
  assert.equal(b.hoseActive, false);
  assert.equal(b.jetCooldown, 0, "releasing a hose must not also fire a burst");
  assert.equal(b.jetTime, 0);
});

test("cancelled Jet input cannot turn a pending tap into an accidental burst", () => {
  const b = createBody(0, 0, 0);
  stepBody(b, input({ jet: true }), flat, 1 / 60);
  stepBody(b, input({ cancelActions: true }), flat, 1 / 60);
  assert.equal(b.jetTime, 0);
  assert.equal(b.jetCooldown, 0);
  assert.equal(b.hoseActive, false);
});
test("rock collision resolves separation and reflects incoming slide velocity", () => {
  const env = { ...flat, obstacles: [{ x: 0, z: 1, radius: 0.3, height: 2 }] },
    b = createBody(0, 0, 0);
  b.yaw = 0;
  tick(b, input({ slide: true }), env, 0.3);
  assert.ok(Math.hypot(b.x, b.z - 1) >= 0.529);
  assert.ok(b.vz < 0);
});
test("6000 alternating modes remain finite and body state contains no scene object", () => {
  const b = createBody(0, 0, -0.2);
  for (let j = 0; j < 6000; j++) {
    stepBody(
      b,
      input({
        x: Math.sin(j * 0.02),
        z: Math.cos(j * 0.02),
        jet: j % 120 === 0,
        dive: j % 500 < 100,
        ascend: j % 500 > 300,
        slide: j % 400 < 200,
      }),
      pond,
      1 / 60,
    );
    for (const key of ["x", "y", "z", "vx", "vy", "vz", "yaw"])
      assert.ok(Number.isFinite(b[key]));
    assert.ok(Math.hypot(b.vx, b.vz) <= 12.01);
  }
  assert.ok(!JSON.stringify(b).includes("uuid"));
});

import {
  treesForChunk,
  obstaclesAt,
  region,
} from "../src/player/movement-region.js";
test("tree collision proxies agree with deterministic presentation and remain nearby", () => {
  const trees = treesForChunk(-1, 0);
  assert.deepEqual(trees, treesForChunk(-1, 0));
  assert.ok(trees.length > 0);
  for (const t of trees) {
    const proxies = obstaclesAt(t.x, t.z);
    assert.ok(
      proxies.some((o) => o.x === t.x && o.z === t.z && o.radius === 0.32),
    );
  }
  const b = createBody(-10, 18, region.sample(-10, 18).height);
  tick(b, input({ z: -1, run: true }), region, 3);
  assert.ok(b.z < 18);
});
