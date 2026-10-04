import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { MovementScenery } from "../src/player/movement-scenery.js";
import { createBody } from "../src/player/body-state.js";
import { WATER_BASE, WATER_SURFACE_Y } from "../src/simulation/water-level.js";
import { heightAt } from "../src/worldgen.js";

const makeStreaming = () => ({
  chunks: {
    onChunkBuild: () => {},
    onChunkRemove: () => {},
  },
});

test("movement scenery reserves its particle stream for Water Jet", () => {
  const parent = new THREE.Group();
  const scenery = new MovementScenery(parent, makeStreaming());
  const body = createBody(0, 0, 0);

  body.mode = "land";
  body.jetTime = 0;
  body.impact = 0.2;
  scenery.update(body, 1 / 60);
  assert.equal(scenery.pool.count, 0, "land movement/impact must not emit water");

  body.mode = "swim";
  body.impact = 0;
  scenery.update(body, 1 / 60);
  assert.equal(scenery.pool.count, 0, "ordinary swimming must not emit the Jet stream");

  body.jetTime = 0.2;
  scenery.update(body, 1 / 60);
  assert.equal(scenery.pool.count, 32, "Water Jet activates its dedicated particle stream");

  body.jetTime = 0;
  scenery.update(body, 1 / 60);
  assert.equal(scenery.pool.count, 0, "Jet stream stops as soon as Jet time ends");

  scenery.dispose();
});

test("Jet trail density follows presentation budget while remaining Jet-only", () => {
  const parent = new THREE.Group();
  const scenery = new MovementScenery(parent, makeStreaming());
  const body = createBody(0, 0, 0);
  body.mode = "swim";
  body.jetTime = 0.2;

  scenery.update(body, 1 / 60, null, 1);
  assert.equal(scenery.pool.count, 32);
  scenery.update(body, 1 / 60, null, 0.35);
  assert.ok(scenery.pool.count >= 8 && scenery.pool.count < 32);

  body.jetTime = 0;
  scenery.update(body, 1 / 60, null, 0.35);
  assert.equal(scenery.pool.count, 0);
  scenery.dispose();
});

test("weather presentation drives foliage wind and pond surface response without changing body state", () => {
  const parent = new THREE.Group();
  const scenery = new MovementScenery(parent, makeStreaming());
  const body = createBody(0, 0, 0);
  const before = { x: body.x, y: body.y, z: body.z, mode: body.mode };

  scenery.update(body, 1 / 60, null, 1, {
    windStrength: 0.92,
    wetGround: 0.8,
    rippleStrength: 0.9,
    waterRoughness: 0.42,
  });

  assert.equal(scenery.leafUniforms.wind.value, 0.92);
  assert.equal(scenery.waterUniforms.ripple.value, 0.9);
  assert.equal(scenery.waterMaterial.roughness, 0.42);
  assert.deepEqual(
    { x: body.x, y: body.y, z: body.z, mode: body.mode },
    before,
    "presentation response may not mutate authoritative body state",
  );
  scenery.dispose();
});

test("contact grounding stretches with shell speed, fades with height, and disappears underwater", () => {
  const parent = new THREE.Group();
  const scenery = new MovementScenery(parent, makeStreaming());
  const x = -10,
    z = 18,
    ground = heightAt(x, z),
    body = createBody(x, z, ground);

  body.mode = "slide";
  body.vx = 4;
  body.vz = 0;
  body.yaw = 0.8;
  scenery.update(body, 1 / 60, null, 1);
  assert.equal(scenery.contact.visible, true);
  assert.ok(scenery.contact.scale.x > scenery.contact.scale.y);
  const groundedOpacity = scenery.contact.material.opacity;

  body.y = ground + 1.1;
  scenery.update(body, 1 / 60, null, 1);
  assert.ok(scenery.contact.material.opacity < groundedOpacity);

  body.x = 0;
  body.z = 0;
  body.y = WATER_SURFACE_Y(WATER_BASE) - 0.05;
  scenery.update(body, 1 / 60, WATER_BASE, 1);
  assert.equal(scenery.contact.visible, false, "submerged bodies must not cast a ground decal through water");
  scenery.dispose();
});


test("leaving water lays a bounded alternating wet trail that fades without save state", () => {
  const parent = new THREE.Group();
  const scenery = new MovementScenery(parent, makeStreaming());
  const body = createBody(0, 0, WATER_SURFACE_Y(WATER_BASE) - 0.05);
  body.mode = "swim";
  body.grounded = false;
  scenery.update(body, 1 / 60, WATER_BASE, 1, { wetGround: 0.6 });
  assert.equal(scenery.wetTrail.count, 0);

  body.x = -10;
  body.z = 18;
  body.y = heightAt(body.x, body.z);
  body.mode = "land";
  body.grounded = true;
  body.vx = 1.2;
  body.vz = 0;
  scenery.update(body, 1 / 60, WATER_BASE, 1, { wetGround: 0.6 });
  assert.ok(scenery.wetTrail.count > 0, "first dry steps after a swim must leave wet contact evidence");
  const firstCount = scenery.wetTrail.count;

  for (let i = 0; i < 20; i++) {
    body.x += 0.4;
    scenery.update(body, 1 / 60, WATER_BASE, 1, { wetGround: 0.6 });
  }
  assert.ok(scenery.wetTrail.count <= 12, "wet trail stays inside its fixed presentation budget");
  assert.ok(scenery.wetTrail.count >= firstCount);

  body.vx = 0;
  for (let i = 0; i < 420; i++)
    scenery.update(body, 1 / 60, WATER_BASE, 1, { wetGround: 0 });
  assert.equal(scenery.wetTrail.count, 0, "old wet marks must age away");
  scenery.dispose();
});

test("nearby foliage receives local brush input from Squirtle without changing tree geometry", () => {
  const parent = new THREE.Group();
  const scenery = new MovementScenery(parent, makeStreaming());
  const body = createBody(3, -4, heightAt(3, -4));
  body.vx = 2.4;
  scenery.update(body, 1 / 60, null, 1, { windStrength: 0.4 });
  assert.equal(scenery.leafUniforms.player.value.x, body.x);
  assert.equal(scenery.leafUniforms.player.value.y, body.z);
  assert.ok(scenery.leafUniforms.brush.value > 0.8);

  body.vx = 0;
  scenery.update(body, 1 / 60, null, 1, { windStrength: 0.4 });
  assert.equal(scenery.leafUniforms.brush.value, 0);
  scenery.dispose();
});

test("measured shoreline carries a second shared-geometry lap pulse without widening geometry count", () => {
  const parent = new THREE.Group();
  const scenery = new MovementScenery(parent, makeStreaming());
  const body = createBody(-10, 18, heightAt(-10, 18));

  scenery.update(body, 0.37, WATER_BASE, 1, { rippleStrength: 1 });
  assert.equal(
    scenery.shoreLap.geometry,
    scenery.shore.geometry,
    "lap pulse must reuse the exact measured shoreline geometry",
  );
  assert.ok(scenery.shoreLapMaterial.opacity > 0.2);
  assert.notEqual(scenery.shoreLap.scale.x, 1, "lap pulse must move perceptibly over time");
  scenery.dispose();
});

test("loaded tree positions expose bounded local canopy cover for environmental audio", () => {
  const parent = new THREE.Group();
  const scenery = new MovementScenery(parent, makeStreaming());
  const group = new THREE.Group();
  group.userData.trees = [{ x: 2, z: 3, h: 5 }];
  scenery.groups.set("fixture", group);

  assert.ok(scenery.canopyCoverAt(2, 3) > 0.9);
  assert.equal(scenery.canopyCoverAt(20, 20), 0);
  assert.ok(scenery.canopyCoverAt(4.5, 3) > 0);
  scenery.dispose();
});
