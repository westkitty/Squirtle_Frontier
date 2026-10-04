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

test("fast shell slide visibly spins the shell without changing body yaw", () => {
  const { presentation } = createMockSquirtle();
  const b = createBody(0, 0, 0);
  b.mode = "slide";
  b.grounded = true;
  b.vx = 4;
  b.yaw = 0.7;

  const yawBefore = b.yaw;
  for (let i = 0; i < 20; i++) presentation.present(b, 1 / 60);

  assert.ok(presentation.shellSpin > 0.5, "shell spin phase must advance with speed");
  assert.ok(
    Math.abs(presentation.visual.rotation.y) > 0.5,
    "presentation wrapper must visibly rotate during slide",
  );
  assert.equal(b.yaw, yawBefore, "visual spin may not mutate authoritative body yaw");
  presentation.dispose();
});

test("physical impact gives Squirtle a bounded squash response", () => {
  const { presentation } = createMockSquirtle();
  const b = createBody(0, 0, 0);
  b.mode = "land";
  b.grounded = true;
  b.impact = 0.24;

  for (let i = 0; i < 6; i++) presentation.present(b, 1 / 60);
  assert.ok(presentation.visual.scale.y < 0.99, "impact must compress vertical presentation");
  assert.ok(presentation.visual.scale.x > 1, "impact must widen presentation slightly");
  assert.ok(
    presentation.visual.scale.y > 0.84,
    "squash must remain bounded rather than distorting the creature",
  );
  presentation.dispose();
});

test("aquatic and shell turning banks the visible body without mutating body yaw", () => {
  const { presentation } = createMockSquirtle();
  const b = createBody(0, 0, 0);
  b.mode = "swim";
  b.vx = 2.5;
  b.vz = 0;
  b.yaw = 0;
  presentation.present(b, 1 / 60);
  const yawBefore = 0.45;
  b.yaw = yawBefore;
  presentation.present(b, 1 / 60);
  assert.ok(
    Math.abs(presentation.motionBank) > 0.02,
    "visible body must bank into a meaningful aquatic turn",
  );
  assert.ok(
    Math.abs(presentation.visual.rotation.z) > 0.02,
    "bank must reach the presentation wrapper",
  );
  assert.equal(b.yaw, yawBefore, "presentation may not rewrite body yaw");

  b.mode = "slide";
  b.yaw = 0.8;
  presentation.present(b, 1 / 60);
  assert.ok(Math.abs(presentation.motionBank) > 0.02);
  presentation.dispose();
});

test("aquatic body pitch follows vertical travel direction within a bounded attitude", () => {
  const { presentation } = createMockSquirtle();
  const b = createBody(0, 0, 0);
  b.mode = "dive";
  b.vx = 1.2;
  b.vz = 0;

  b.vy = -3;
  for (let i = 0; i < 20; i++) presentation.present(b, 1 / 60);
  const descending = presentation.visual.rotation.x;

  b.vy = 3;
  for (let i = 0; i < 20; i++) presentation.present(b, 1 / 60);
  const rising = presentation.visual.rotation.x;
  assert.ok(descending > rising, "descending must pitch more steeply than rising");
  assert.ok(descending < 1.15 && rising > 0.7, "aquatic attitude remains bounded");
  presentation.dispose();
});

test("attention target orients gaze yaw and pitch within physiological clamping bounds", () => {
  const { presentation } = createMockSquirtle();
  const b = createBody(0, 0, 0);
  b.yaw = 0; // Facing +Z
  b.grounded = true;
  b.mode = "land";

  // Target 45 degrees to the right (+X, +Z) and elevated
  const target = { x: 3, y: 1.5, z: 3 };

  // Step presentation several frames for smooth saccadic tracking
  for (let i = 0; i < 30; i++) presentation.present(b, 1 / 60, target);

  assert.ok(presentation.attention === target, "active attention must be set");
  assert.ok(presentation.gazeYaw > 0.3, "head must turn right toward target");
  assert.ok(presentation.gazePitch > 0.1, "head must tilt up toward elevated target");

  // Extreme target at 90 degrees to the right (+X, 0)
  const extremeTarget = { x: 10, y: 0, z: 0 };
  for (let i = 0; i < 30; i++) presentation.present(b, 1 / 60, extremeTarget);

  assert.ok(
    presentation.gazeYaw <= 0.85,
    "gaze yaw must not exceed physiological limit (0.85 rad)",
  );
  assert.ok(
    presentation.gazeYaw >= -0.85,
    "gaze yaw must not exceed negative physiological limit",
  );
  assert.ok(
    presentation.gazePitch <= 0.45 && presentation.gazePitch >= -0.38,
    "gaze pitch must stay within physiological limits",
  );
  presentation.dispose();
});

test("running fast focuses gaze forward along travel direction", () => {
  const { presentation } = createMockSquirtle();
  const b = createBody(0, 0, 0);
  b.yaw = 0;
  b.grounded = true;
  b.mode = "land";

  const target = { x: 3, y: 0, z: 3 };
  for (let i = 0; i < 30; i++) presentation.present(b, 1 / 60, target);
  assert.ok(presentation.gazeYaw > 0.3, "initial gaze turns toward target");

  // Accelerate into run
  b.vx = 0;
  b.vz = 3.5; // speed > 2.2
  for (let i = 0; i < 30; i++) presentation.present(b, 1 / 60, target);

  assert.equal(presentation.attention, null, "attention is suppressed while running fast");
  assert.ok(Math.abs(presentation.gazeYaw) < 0.1, "gaze resets forward along travel direction");
  presentation.dispose();
});

test("shell slide suppresses attention tracking and zeroes look angles", () => {
  const { presentation } = createMockSquirtle();
  const b = createBody(0, 0, 0);
  b.mode = "slide";
  b.grounded = true;

  const target = { x: 4, y: 1, z: 2 };
  for (let i = 0; i < 15; i++) presentation.present(b, 1 / 60, target);

  assert.equal(presentation.attention, null, "attention must be null in shell slide");
  assert.equal(presentation.gazeYaw, 0, "gaze yaw must be exactly 0 in shell slide");
  assert.equal(presentation.gazePitch, 0, "gaze pitch must be exactly 0 in shell slide");
  presentation.dispose();
});

test("clearing attention target decays gaze back to resting orientation", () => {
  const { presentation } = createMockSquirtle();
  const b = createBody(0, 0, 0);
  b.yaw = 0;
  b.grounded = true;
  b.mode = "land";

  const target = { x: 3, y: 0, z: 3 };
  for (let i = 0; i < 30; i++) presentation.present(b, 1 / 60, target);
  assert.ok(presentation.gazeYaw > 0.3);

  // Clear attention target
  for (let i = 0; i < 40; i++) presentation.present(b, 1 / 60, null);

  assert.equal(presentation.attention, null);
  assert.ok(Math.abs(presentation.gazeYaw) < 0.08, "gaze yaw must decay back toward neutral");
  presentation.dispose();
});

test("prolonged undisturbed idle transitions into living slumber crouch with slowed respiration", () => {
  const { presentation } = createMockSquirtle();
  const b = createBody(0, 0, 0);
  b.grounded = true;
  b.mode = "land";

  // Step 6 seconds of undisturbed idle on land
  for (let i = 0; i < 370; i++) presentation.present(b, 1 / 60);

  assert.equal(presentation.isSleeping, true, "must enter sleeping state after >5.5s idle");
  assert.ok(presentation.sleepProgress > 0.8, "sleep progress must advance near 1.0");
  assert.ok(
    presentation.bones.get("Head").node.rotation.x < -0.15,
    "head must nod down onto chest in restful sleep",
  );
  assert.ok(
    presentation.bones.get("LArm").node.rotation.z < -0.3,
    "front arms must relax down beside shell in resting crouch",
  );
  assert.ok(
    presentation.bones.get("LThigh").node.rotation.z > 0.25,
    "hind thighs must splay outward into stable sitting crouch",
  );
  assert.ok(
    presentation.bones.get("Tail3").node.rotation.y > 0.7,
    "tail tip must curl protectively around flank during sleep",
  );
  presentation.dispose();
});

test("explicit body resting flag triggers peaceful shell sleep and curled tail", () => {
  const { presentation } = createMockSquirtle();
  const b = createBody(0, 0, 0);
  b.grounded = true;
  b.mode = "land";
  b.resting = true;

  // Step presentation for rest transition
  for (let i = 0; i < 60; i++) presentation.present(b, 1 / 60);

  assert.equal(presentation.isSleeping, true, "explicit resting flag must activate sleep");
  assert.ok(presentation.sleepProgress > 0.85);
  assert.ok(
    presentation.visual.position.y < -0.05,
    "visual center must lower comfortably toward ground during rest",
  );
  presentation.dispose();
});

test("sleeping state suppresses active saccadic gaze tracking", () => {
  const { presentation } = createMockSquirtle();
  const b = createBody(0, 0, 0);
  b.grounded = true;
  b.mode = "land";
  b.resting = true;

  const target = { x: 5, y: 1, z: 2 };
  // Step while resting with salient target present
  for (let i = 0; i < 60; i++) presentation.present(b, 1 / 60, target);

  assert.equal(presentation.isSleeping, true);
  assert.equal(presentation.attention, null, "sleeping suppresses active attention target");
  assert.equal(presentation.gazeYaw, 0, "sleeping zeroes gaze yaw");
  assert.equal(presentation.gazePitch, 0, "sleeping zeroes gaze pitch");
  presentation.dispose();
});

test("movement input wakes Squirtle and smoothly restores alert upright stance", () => {
  const { presentation } = createMockSquirtle();
  const b = createBody(0, 0, 0);
  b.grounded = true;
  b.mode = "land";
  b.resting = true;

  // Settle into sleep
  for (let i = 0; i < 60; i++) presentation.present(b, 1 / 60);
  assert.equal(presentation.isSleeping, true);

  // Wake up by moving
  b.resting = false;
  b.vx = 2.0;
  for (let i = 0; i < 60; i++) presentation.present(b, 1 / 60);

  assert.equal(presentation.isSleeping, false, "movement must awaken Squirtle");
  assert.ok(presentation.sleepProgress < 0.1, "sleep progress must decay to zero");
  assert.ok(
    presentation.visual.position.y > -0.01,
    "visual elevation must restore to upright stance",
  );
  presentation.dispose();
});

test("presentation cleanly disposes materials, skeletons and releases asset handle", () => {
  const { presentation, isReleased } = createMockSquirtle();
  presentation.dispose();
  assert.equal(presentation.disposed, true);
  assert.equal(isReleased(), true);
});
