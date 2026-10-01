import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { SquirtlePresentation } from "../src/assets/squirtle-presentation.js";
import { createBody } from "../src/player/body-state.js";

function createMockSquirtle() {
  const root = new THREE.Group();
  const bones = [
    "joint0",
    "joint1",
    "joint2",
    "joint3",
    "joint4",
    "joint9",
    "joint10",
    "joint13",
    "joint14",
    "joint19",
    "joint20",
    "joint23",
    "joint24",
    "joint25",
  ];
  for (const name of bones) {
    const bone = new THREE.Bone();
    bone.name = name;
    root.add(bone);
  }
  const mesh = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial(),
  );
  root.add(mesh);
  let released = false;
  const assets = {
    release: () => {
      released = true;
    },
  };
  const presentation = new SquirtlePresentation(assets, { root });
  return { presentation, assets, root, isReleased: () => released };
}

test("presentation assigns semantic roles including full tail and limb articulation", () => {
  const { presentation } = createMockSquirtle();
  for (const role of [
    "Head",
    "Snout",
    "LArm",
    "LForearm",
    "RArm",
    "RForearm",
    "LThigh",
    "LCalf",
    "RThigh",
    "RCalf",
    "Tail1",
    "Tail2",
    "Tail3",
  ]) {
    assert.ok(presentation.bones.has(role), `missing mapped role: ${role}`);
  }
  assert.equal(presentation.isLiving, true);
  presentation.dispose();
});

test("stationary idle on land breathes and sways tail instead of freezing into a bind-pose statue", () => {
  const { presentation } = createMockSquirtle();
  const b = createBody(0, 0, 0);
  b.vx = 0;
  b.vz = 0;
  b.grounded = true;
  b.mode = "land";

  presentation.present(b, 0.4);
  assert.ok(
    presentation.bones.get("Tail1").node.rotation.y !== 0,
    "tail must sway during living idle",
  );
  assert.ok(
    presentation.bones.get("Head").node.rotation.x !== 0,
    "head must nod subtly with respiration",
  );

  // After remaining stationary past 1.5 seconds, curious glancing activates
  for (let i = 0; i < 90; i++) presentation.present(b, 1 / 60);
  assert.ok(presentation.idleDuration > 1.5);
  assert.ok(
    presentation.bones.get("Head").node.rotation.y !== 0,
    "head must glance with curious look during sustained idle",
  );
  presentation.dispose();
});

test("aquatic locomotion executes flipper paddle strokes and tail rudder undulation", () => {
  const { presentation } = createMockSquirtle();
  const b = createBody(0, 0, 0);
  b.mode = "swim";
  b.vx = 2.5;
  b.vz = 0;

  presentation.present(b, 0.2);
  assert.ok(presentation.swimStroke > 0, "swimming stroke phase must advance");
  assert.ok(
    presentation.bones.get("LArm").node.rotation.y !== 0,
    "front flippers must sweep during swim",
  );
  assert.ok(
    presentation.bones.get("LForearm").node.rotation.y !== 0,
    "forearms must articulate during swim stroke",
  );
  assert.ok(
    presentation.bones.get("Tail3").node.rotation.y !== 0,
    "tail tip must undulate as swimming rudder",
  );
  presentation.dispose();
});

test("water exit triggers an emergent dry shake that decays cleanly", () => {
  const { presentation } = createMockSquirtle();
  const b = createBody(0, 0, 0);
  b.mode = "swim";
  presentation.present(b, 0.1);

  // Step out of water onto land
  b.mode = "land";
  b.grounded = true;
  b.vx = 0;
  b.vz = 0;
  presentation.present(b, 0.05);

  assert.equal(presentation.isShaking, true);
  assert.ok(
    presentation.bones.get("Head").node.rotation.y !== 0,
    "head shakes off water",
  );

  // Decays after duration
  presentation.present(b, 0.65);
  assert.equal(presentation.isShaking, false);
  presentation.dispose();
});

test("shell slide retracts all extremities and responds to impacts", () => {
  const { presentation } = createMockSquirtle();
  const b = createBody(0, 0, 0);
  b.mode = "slide";
  b.impact = 0.25;

  for (let i = 0; i < 40; i++) presentation.present(b, 1 / 60);

  assert.ok(
    presentation.shellRetraction > 0.9,
    "shell retraction must exceed 0.9 in slide mode",
  );
  assert.ok(
    presentation.bones.get("Tail3").node.scale.x < 0.15,
    "tail must retract into shell",
  );
  assert.ok(
    presentation.bones.get("Head").node.scale.x < 0.15,
    "head must retract into shell",
  );
  assert.ok(
    presentation.visual.rotation.z !== 0,
    "shell must wobble on physical impact",
  );
  presentation.dispose();
});

test("presentation cleanly disposes materials, skeletons and releases asset handle", () => {
  const { presentation, isReleased } = createMockSquirtle();
  presentation.dispose();
  assert.equal(presentation.disposed, true);
  assert.equal(isReleased(), true);
});
