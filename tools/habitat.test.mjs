import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  HabitatView,
  labHeight,
  labRegion,
} from "../src/player/habitat-view.js";
import { WorldState } from "../src/worldstate.js";
import { createBody } from "../src/player/body-state.js";
import { stepBody } from "../src/player/squirtle-controller.js";
import { Streaming } from "../src/streaming.js";
test("Lab floor samples agree with geometry and body supports dive and ascent", () => {
  const scene = new THREE.Scene(),
    view = new HabitatView(scene, { lab: true });
  const ground = view.resources.find((r) => r.type === "PlaneGeometry"),
    p = ground.attributes.position;
  for (let i = 0; i < p.count; i++)
    assert.ok(Math.abs(p.getY(i) - labHeight(p.getX(i), p.getZ(i))) < 1e-6);
  const b = createBody(0, 0, -0.42);
  b.grounded = false;
  const input = { x: 0, z: 0, dive: true };
  for (let i = 0; i < 40; i++) stepBody(b, input, labRegion, 1 / 60);
  assert.equal(b.mode, "dive");
  assert.ok(b.y < -0.8);
  for (let i = 0; i < 180; i++)
    stepBody(b, { x: 0, z: 0, ascend: true }, labRegion, 1 / 60);
  assert.equal(b.mode, "swim");
  assert.ok(b.y > -0.5);
  view.dispose();
  assert.equal(scene.children.length, 0);
});
test("streaming suspend releases chunks, resets queue and permits same-position resume", () => {
  const stream = new Streaming(new THREE.Scene(), new WorldState());
  while (stream.stats().active < 9) stream.update(0, 0);
  stream.suspend();
  assert.equal(stream.stats().active, 0);
  assert.equal(stream.stats().queued, 0);
  while (stream.stats().active < 9) stream.update(0, 0);
  assert.equal(stream.stats().loads - stream.stats().unloads, 9);
  stream.dispose();
});

test("Lab wall proxies stop body traversal and preserve a clear camera boom", async () => {
  const { CreatureCamera } = await import("../src/player/creature-camera.js");
  const b = createBody(0, -6, 0);
  b.yaw = Math.PI;
  for (let i = 0; i < 180; i++)
    stepBody(b, { x: 0, z: -1, run: true }, labRegion, 1 / 60);
  assert.ok(b.z > -7.4);
  const rig = new CreatureCamera(
    new THREE.PerspectiveCamera(55, 1.5, 0.04, 100),
    labRegion,
  );
  rig.yaw = 0;
  rig.update(b, 1 / 60, {
    sensitivity: 1,
    reducedMotion: true,
  });
  assert.ok(rig.camera.position.z > -7.5);
});

import { placeAction } from "../src/simulation/place-interaction.js";
test("rest requires grounded proximity to Lab platform; no remote or underwater action", () => {
  assert.equal(placeAction("lab", { x: -4.4, z: 5.6, grounded: true }), "rest");
  assert.equal(placeAction("lab", { x: -4.4, z: 5.6, grounded: false }), null);
  assert.equal(
    placeAction("frontier", { x: -4.4, z: 5.6, grounded: true }),
    null,
  );
  assert.equal(placeAction("lab", { x: 0, z: 0, grounded: true }), null);
  assert.equal(placeAction("lab", { x: 0, z: 6, grounded: true }), "leave");
});

test("HabitatView animates caretaker with living welcoming gestures and pensive check-water posture", () => {
  const scene = new THREE.Scene();
  const view = new HabitatView(scene, { lab: false });
  const body = createBody(-13, -10, 0);
  const eco = { reeds: 0.5, prey: 0.5, cistern: 0.5 };
  const s = { response: "welcome", familiarity: 0.5, bowl: 0.5 };

  // 1. Welcome mode: arm waves dynamically with elapsed time
  view.update(eco, body, 0.0, null, null, s, 1 / 60);
  const armRot0 = view.arm.rotation.z;
  const posY0 = view.caretaker.position.y;

  view.update(eco, body, 0.4, null, null, s, 1 / 60);
  const armRot1 = view.arm.rotation.z;
  const posY1 = view.caretaker.position.y;

  assert.notEqual(armRot0, armRot1, "caretaker arm must animate wave cadence across elapsed time");
  assert.notEqual(posY0, posY1, "caretaker must subtly bob with respiration");

  // 2. Check-water mode: caretaker tilts forward toward dry trough
  const sCheck = { response: "check-water", familiarity: 0.5, bowl: 0.0 };
  view.update(eco, body, 1.0, null, null, sCheck, 1 / 60);
  assert.ok(view.caretaker.rotation.x > 0.15, "caretaker must bow head toward dry trough");

  view.dispose();
  assert.equal(scene.children.length, 0);
});

