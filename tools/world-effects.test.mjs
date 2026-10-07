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
  assert.equal(fx.fireSmoke.geometry, fx.geo);
  assert.equal(fx.rain.geometry, fx.geo);
  assert.equal(fx.jet.geometry, fx.geo);
  assert.equal(fx.wake.geometry, fx.geo);
  assert.equal(fx.splash.geometry, fx.geo);
  assert.equal(fx.slideDust.geometry, fx.geo);
  assert.equal(fx.streamFoam.geometry, fx.geo);
  assert.equal(fx.rainRipples.geometry, fx.geo);
  assert.equal(fx.underwaterMotes.geometry, fx.geo);

  fx.dispose();
  assert.equal(fx.group.parent, null);
});

test("Water Hose stream follows camera aim and reaches 2.8m", () => {
  const parent = new THREE.Group();
  const fx = new WorldEffects(parent);
  const state = createMockState();
  const body = createBody(5, 5, 1);
  body.yaw = Math.PI / 4;

  // 1. Idle / no hose
  body.hoseActive = false;
  fx.update(state, body);
  assert.equal(fx.jet.visible, false);
  assert.equal(fx.jet.count, 0);

  // 2. Active hose, aimed 45 degrees in camera space
  body.hoseActive = true;
  body.hoseAimX = Math.SQRT1_2;
  body.hoseAimY = 0;
  body.hoseAimZ = Math.SQRT1_2;
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

  // Trajectory should align with camera-derived hose direction.
  const forwardX = body.hoseAimX;
  const forwardZ = body.hoseAimZ;
  const dot = (dx * forwardX + dz * forwardZ) / horizontalDist;
  assert.ok(
    dot > 0.95,
    `hose stream should align with camera aim, dot product was ${dot.toFixed(3)}`,
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
  body.hoseActive = true;
  fx.update(state, body, { water });
  assert.equal(fx.wake.visible, false, "Water Hose must not stack the ordinary swim wake");
  assert.equal(fx.wake.count, 0);
  body.hoseActive = false;
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

test("rain visibly meets nearby water with bounded surface ripples", () => {
  const parent = new THREE.Group();
  const fx = new WorldEffects(parent);
  const state = createMockState();
  const body = createBody(0, 0, 0.4);
  const water = { level: 0.5 };

  state.frontier.weather.rain = 0;
  fx.update(state, body, { water });
  assert.equal(fx.rainRipples.count, 0);

  state.frontier.weather.rain = 1;
  fx.update(state, body, { water, effectScale: 1 });
  assert.equal(fx.rainRipples.count, 18);
  const full = fx.rainRipples.count;

  fx.update(state, body, { water, effectScale: 0.4 });
  assert.ok(fx.rainRipples.count >= 3 && fx.rainRipples.count < full);

  fx.update(state, body, { water: null, effectScale: 1 });
  assert.equal(fx.rainRipples.count, 0, "rain over dry ground must not invent water rings");
  fx.dispose();
});

test("dive particulates scale with real sediment and contamination without touching simulation state", () => {
  const parent = new THREE.Group();
  const fx = new WorldEffects(parent);
  const state = createMockState();
  state.watershed = {
    nodes: [{}, {}, { sediment: 0.05, contamination: 0.02 }],
  };
  const body = createBody(0, 0, 0);
  body.mode = "dive";
  body.y = -0.5;
  const water = { level: 0.5 },
    before = JSON.stringify(state.watershed.nodes[2]);

  fx.update(state, body, { water, effectScale: 1 });
  const clearCount = fx.underwaterMotes.count;
  assert.ok(clearCount >= 5);

  state.watershed.nodes[2].sediment = 0.9;
  state.watershed.nodes[2].contamination = 0.7;
  fx.update(state, body, { water, effectScale: 1 });
  assert.ok(
    fx.underwaterMotes.count > clearCount,
    "murkier water must carry more visible suspended material",
  );
  assert.equal(
    JSON.stringify({ sediment: 0.9, contamination: 0.7 }),
    JSON.stringify(state.watershed.nodes[2]),
    "presentation may not rewrite watershed state",
  );

  body.mode = "swim";
  fx.update(state, body, { water, effectScale: 1 });
  assert.equal(fx.underwaterMotes.count, 0, "surface swimming must not carry the dive field");
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

test("active fires trail smoke and dry shell slides kick up bounded dust", () => {
  const parent = new THREE.Group();
  const fx = new WorldEffects(parent);
  const state = createMockState();
  const p = fireSite(0);
  const body = createBody(p.x, p.z, 0);
  state.frontier.heat[0] = 0.8;
  fx.update(state, body, { water: null, effectScale: 1 });
  assert.ok(fx.fireSmoke.count > 0, "visible fire must carry smoke");

  body.mode = "slide";
  body.vx = 4;
  body.vz = 0;
  fx.update(state, body, { water: null, effectScale: 1 });
  assert.ok(fx.slideDust.count >= 4, "fast dry shell slide must kick up dust");
  fx.update(state, body, { water: { level: 0.4 }, effectScale: 1 });
  assert.equal(fx.slideDust.count, 0, "shell dust must stop in water");
  fx.dispose();
});

test("saturated nearby wetland grows bounded mist without adding geometry", () => {
  const parent = new THREE.Group();
  const fx = new WorldEffects(parent);
  const state = createMockState();
  state.watershed = {
    nodes: [{}, {}, { wetness: 0.95 }],
  };
  const body = createBody(-6, -15, 0);

  fx.update(state, body, { effectScale: 1 });
  assert.ok(fx.wetlandMist.count >= 10);
  assert.equal(fx.wetlandMist.visible, true);
  assert.equal(fx.wetlandMist.geometry, fx.geo, "mist must reuse shared effect geometry");
  assert.equal(fx.stats().mist, fx.wetlandMist.count);

  body.x = 60;
  body.z = 60;
  fx.update(state, body, { effectScale: 1 });
  assert.equal(fx.wetlandMist.count, 0, "distant wetland must cost no mist instances");
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

test("animated instanced effects use dynamic draw buffers and presentation density scales particles only", () => {
  const parent = new THREE.Group();
  const fx = new WorldEffects(parent);
  for (const mesh of [
    fx.fire,
    fx.fireSmoke,
    fx.rain,
    fx.jet,
    fx.wake,
    fx.splash,
    fx.slideDust,
    fx.wetlandMist,
    fx.rainRipples,
    fx.underwaterMotes,
    fx.streamFoam,
  ])
    assert.equal(
      mesh.instanceMatrix.usage,
      THREE.DynamicDrawUsage,
      "animated instance matrices must tell WebGL they change frequently",
    );

  const state = createMockState(),
    body = createBody(0, 0, 0.4);
  state.frontier.weather.rain = 1;
  body.mode = "swim";
  body.vx = 4;
  body.hoseActive = true;
  fx.update(state, body, {
    water: { level: 0.5 },
    effectScale: 1,
    channelFlow: 1,
  });
  const fullJet = fx.jet.count,
    fullRain = fx.rain.count;
  fx.update(state, body, {
    water: { level: 0.5 },
    effectScale: 0.35,
    channelFlow: 1,
  });
  assert.ok(fx.jet.count < fullJet && fx.jet.count >= 8);
  assert.ok(fx.rain.count < fullRain);
  assert.equal(body.hoseActive, true, "visual density may not alter Hose state");
  fx.dispose();
});


test("rain terrain sampling is spatially cached across nearby frames", () => {
  const parent = new THREE.Group(),
    fx = new WorldEffects(parent),
    state = createMockState(),
    body = createBody(0, 0, 0);
  state.frontier.weather.rain = 1;

  fx.update(state, body, { effectScale: 1 });
  const first = fx.stats();
  assert.equal(first.rainGroundRefreshes, 1);
  assert.ok(first.terrainSamples >= 112);

  state.elapsed += 0.05;
  body.x += 0.1;
  body.z += 0.1;
  fx.update(state, body, { effectScale: 1 });
  const cached = fx.stats();
  assert.equal(
    cached.rainGroundRefreshes,
    first.rainGroundRefreshes,
    "sub-cell movement inside the refresh window must reuse rain ground samples",
  );
  assert.equal(cached.terrainSamples, first.terrainSamples);

  body.x += 1;
  state.elapsed += 0.05;
  fx.update(state, body, { effectScale: 1 });
  assert.equal(fx.stats().rainGroundRefreshes, first.rainGroundRefreshes + 1);
  fx.dispose();
});

test("channel foam height path rebuilds only when channel stage changes", () => {
  const parent = new THREE.Group(),
    fx = new WorldEffects(parent),
    state = createMockState(),
    body = createBody(0, 0, 0);
  state.frontier.stage = 2;
  state.watershed = { nodes: [{}, {}, { wetness: 0.8 }] };

  fx.update(state, body, { channelFlow: 1 });
  const rebuilt = fx.stats().foamRebuilds;
  assert.ok(rebuilt >= 1);
  for (let i = 0; i < 30; i++) {
    state.elapsed += 1 / 60;
    fx.update(state, body, { channelFlow: 1 });
  }
  assert.equal(
    fx.stats().foamRebuilds,
    rebuilt,
    "animation must travel over the precomputed path without rebuilding terrain",
  );

  state.frontier.stage = 3;
  fx.update(state, body, { channelFlow: 1 });
  assert.equal(fx.stats().foamRebuilds, rebuilt + 1);
  fx.dispose();
});

test("effect batch roots keep static object matrices while instance buffers animate", () => {
  const parent = new THREE.Group(),
    fx = new WorldEffects(parent);
  for (const mesh of [
    fx.fire,
    fx.fireSmoke,
    fx.rain,
    fx.jet,
    fx.wake,
    fx.splash,
    fx.slideDust,
    fx.streamFoam,
    fx.wetlandMist,
    fx.rainRipples,
    fx.underwaterMotes,
    fx.channel,
  ])
    assert.equal(
      mesh.matrixAutoUpdate,
      false,
      "identity batch roots should not recompute Object3D matrices each frame",
    );
  fx.dispose();
});
