import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { WorldEffects } from "../src/player/world-effects.js";
import { createBody } from "../src/player/body-state.js";
import { fireSite } from "../src/simulation/frontier-systems.js";

function createMockState() {
  return {
    elapsed: 10.0,
    frontier: {
      stage: 1,
      weather: { rain: 0.5 },
      heat: new Float32Array(16),
    },
  };
}

test("WorldEffects reuses single ConeGeometry across all particle systems for zero-allocation rendering", () => {
  const parent = new THREE.Group();
  const fx = new WorldEffects(parent);

  assert.equal(fx.group.parent, parent);
  assert.ok(fx.geo instanceof THREE.BufferGeometry);
  assert.equal(fx.fire.geometry, fx.geo);
  assert.equal(fx.rain.geometry, fx.geo);
  assert.equal(fx.jet.geometry, fx.geo);
  assert.equal(fx.wake.geometry, fx.geo);
  assert.equal(fx.splash.geometry, fx.geo);
  assert.equal(fx.streamFoam.geometry, fx.geo);

  fx.dispose();
  assert.equal(fx.group.parent, null);
});

test("Water Jet stream activates pressurized particle stream reaching 2.8m along forward yaw", () => {
  const parent = new THREE.Group();
  const fx = new WorldEffects(parent);
  const state = createMockState();
  const body = createBody(5, 5, 1);
  body.yaw = Math.PI / 4; // 45 degrees

  // 1. Idle / no jet
  body.jetTime = 0;
  fx.update(state, body);
  assert.equal(fx.jet.visible, false);
  assert.equal(fx.jet.count, 0);

  // 2. Active jet impulse
  body.jetTime = 0.35;
  fx.update(state, body);
  assert.equal(fx.jet.visible, true);
  assert.equal(fx.jet.count, 24);

  // Check spatial reach of furthest particle
  const mat = new THREE.Matrix4();
  fx.jet.getMatrixAt(23, mat);
  const pos = new THREE.Vector3();
  pos.setFromMatrixPosition(mat);

  const dx = pos.x - body.x;
  const dz = pos.z - body.z;
  const horizontalDist = Math.hypot(dx, dz);
  assert.ok(
    horizontalDist >= 2.6 && horizontalDist <= 3.2,
    `furthest jet particle should reach ~2.8m, was ${horizontalDist.toFixed(2)}`,
  );

  // Trajectory should align with forward yaw direction (sin(yaw), cos(yaw))
  const forwardX = Math.sin(body.yaw);
  const forwardZ = Math.cos(body.yaw);
  const dot = (dx * forwardX + dz * forwardZ) / horizontalDist;
  assert.ok(
    dot > 0.95,
    `jet stream should align forward along yaw, dot product was ${dot.toFixed(3)}`,
  );

  fx.dispose();
});

test("Aquatic surface wake generates concentric ripples only when swimming or moving in water", () => {
  const parent = new THREE.Group();
  const fx = new WorldEffects(parent);
  const state = createMockState();
  const body = createBody(0, 0, 1.5); // high on dry land

  // 1. Dry land movement: no surface wake
  body.vx = 2.5;
  body.vz = 0;
  fx.update(state, body, { water: null });
  assert.equal(fx.wake.visible, false);
  assert.equal(fx.wake.count, 0);

  // 2. Swimming in water
  const water = { level: 0.5 };
  body.y = 0.4;
  body.mode = "swim";
  body.vx = 1.8;
  body.vz = 0;
  fx.update(state, body, { water });
  assert.equal(fx.wake.visible, true);
  const mediumWake = fx.wake.count;
  assert.ok(mediumWake > 4 && mediumWake < 16);
  body.vx = 4;
  fx.update(state, body, { water });
  assert.equal(fx.wake.count, 16, "fast swimming earns the full wake budget");
  body.vx = 1.8;

  // Stationary swimming is calm: locomotion does not manufacture a constant spray.
  body.vx = 0;
  body.vz = 0;
  fx.update(state, body, { water });
  assert.equal(fx.wake.visible, false);
  assert.equal(fx.wake.count, 0);

  // Jet owns its own pressurized stream and must not stack the ordinary swim wake.
  body.vx = 1.8;
  body.jetTime = 0.2;
  fx.update(state, body, { water });
  assert.equal(fx.wake.visible, false);
  assert.equal(fx.wake.count, 0);
  body.jetTime = 0;
  fx.update(state, body, { water });

  // Check that wake ripple sits precisely at water surface height
  const mat = new THREE.Matrix4();
  fx.wake.getMatrixAt(0, mat);
  const pos = new THREE.Vector3();
  pos.setFromMatrixPosition(mat);
  assert.ok(
    Math.abs(pos.y - (water.level + 0.015)) < 0.001,
    `wake ripple y (${pos.y}) should sit at water surface level (${water.level + 0.015})`,
  );

  fx.dispose();
});

test("Splash particles scatter radially during water-exit shake or fluid impact", () => {
  const parent = new THREE.Group();
  const fx = new WorldEffects(parent);
  const state = createMockState();
  const body = createBody(0, 0, 0);

  // 1. No shake or impact
  fx.update(state, body, { water: null, isShaking: false });
  assert.equal(fx.splash.visible, false);
  assert.equal(fx.splash.count, 0);

  // 2. Water-exit shake active
  fx.update(state, body, { water: null, isShaking: true });
  assert.equal(fx.splash.visible, true);
  assert.equal(fx.splash.count, 20);

  // Check radial distribution of splash droplets
  const mat0 = new THREE.Matrix4();
  const mat10 = new THREE.Matrix4();
  fx.splash.getMatrixAt(0, mat0);
  fx.splash.getMatrixAt(10, mat10);
  const pos0 = new THREE.Vector3().setFromMatrixPosition(mat0);
  const pos10 = new THREE.Vector3().setFromMatrixPosition(mat10);

  const dist0 = Math.hypot(pos0.x - body.x, pos0.z - body.z);
  const dist10 = Math.hypot(pos10.x - body.x, pos10.z - body.z);
  assert.ok(dist0 > 0.1 && dist10 > 0.1, "droplets should disperse away from body");

  fx.dispose();
});

test("Stream foam rapids particles travel down running channel when stage >= 2", () => {
  const parent = new THREE.Group();
  const fx = new WorldEffects(parent);
  const state = createMockState();
  const body = createBody(0, 0, 0);

  // 1. Stage 1 (dry / early carved groove): no stream foam
  state.frontier.stage = 1;
  fx.update(state, body);
  assert.equal(fx.streamFoam.visible, false);
  assert.equal(fx.streamFoam.count, 0);

  // 2. Stage 2 (active flowing watercourse): stream foam activates
  state.frontier.stage = 2;
  fx.update(state, body);
  assert.equal(fx.streamFoam.visible, true);
  assert.equal(fx.streamFoam.count, 16);

  // Verify particles sit along the channel route
  const mat = new THREE.Matrix4();
  fx.streamFoam.getMatrixAt(0, mat);
  const pos0 = new THREE.Vector3().setFromMatrixPosition(mat);
  assert.ok(
    Number.isFinite(pos0.x) && Number.isFinite(pos0.y) && Number.isFinite(pos0.z),
    "foam position must be finite numbers",
  );

  // Verify stats reports foam count
  const stats = fx.stats();
  assert.equal(stats.foam, 16);

  fx.dispose();
});

test("WorldEffects teardown cleanly disposes all resources without throwing", () => {
  const parent = new THREE.Group();
  const fx = new WorldEffects(parent);
  assert.doesNotThrow(() => fx.dispose());
  assert.equal(fx.group.parent, null);
});

test("effect budgets scale with render pressure, impact intensity and channel flow", () => {
  const parent = new THREE.Group();
  const fx = new WorldEffects(parent);
  const state = createMockState();
  const body = createBody(0, 0, 0);

  state.frontier.weather.rain = 1;
  fx.update(state, body, { renderScale: 1 });
  assert.equal(fx.rain.count, 96);
  fx.update(state, body, { renderScale: 0.5 });
  assert.equal(fx.rain.count, 48);

  body.y = 0.4;
  body.mode = "swim";
  body.impact = 0.08;
  fx.update(state, body, { water: { level: 0.5 }, isShaking: false });
  assert.ok(fx.splash.count >= 6 && fx.splash.count < 20);
  fx.update(state, body, { water: { level: 0.5 }, isShaking: true });
  assert.equal(fx.splash.count, 20);

  state.frontier.stage = 2;
  fx.update(state, body, { channelFlow: 0 });
  assert.equal(fx.streamFoam.count, 0);
  fx.update(state, body, { channelFlow: 0.5 });
  assert.equal(fx.streamFoam.count, 8);
  fx.update(state, body, { channelFlow: 1 });
  assert.equal(fx.streamFoam.count, 16);
  fx.dispose();
});

test("active fire presentation flickers without allocating new geometry", () => {
  const parent = new THREE.Group();
  const fx = new WorldEffects(parent);
  const state = createMockState();
  const p = fireSite(0);
  const body = createBody(p.x, p.z, 0);
  state.frontier.heat[0] = 0.8;
  const a = new THREE.Matrix4(),
    b = new THREE.Matrix4();
  fx.update(state, body);
  assert.ok(fx.fire.count > 0);
  fx.fire.getMatrixAt(0, a);
  state.elapsed += 0.17;
  fx.update(state, body);
  fx.fire.getMatrixAt(0, b);
  assert.notDeepEqual(a.elements, b.elements);
  assert.equal(fx.fire.geometry, fx.geo);
  fx.dispose();
});
