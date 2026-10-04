import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { HabitatView } from "../src/player/habitat-view.js";
import { createBody } from "../src/player/body-state.js";

const ecosystem = () => ({
  labReeds: 0.5,
  reeds: 0.75,
  labFrogs: 0.4,
  prey: 0.7,
  predators: 0.25,
  cistern: 0.5,
  labWater: 0.6,
});

test("reeds react to weather without changing authoritative ecosystem state", () => {
  const parent = new THREE.Group(),
    view = new HabitatView(parent),
    eco = ecosystem(),
    before = { ...eco },
    body = createBody(-6, -15, 0),
    wildlife = { actors: [] },
    low = new THREE.Matrix4(),
    high = new THREE.Matrix4();

  view.update(
    eco,
    body,
    0.2,
    null,
    wildlife,
    null,
    1 / 60,
    { windStrength: 0.08, wetness: 0.2 },
  );
  view.reeds.getMatrixAt(0, low);
  const dryGreen = view.green.color.getHex();

  view.update(
    eco,
    body,
    1.1,
    null,
    wildlife,
    null,
    1 / 60,
    { windStrength: 0.9, wetness: 0.9 },
  );
  view.reeds.getMatrixAt(0, high);

  assert.notDeepEqual(low.elements, high.elements, "wind must move reed presentation");
  assert.notEqual(view.green.color.getHex(), dryGreen, "wetness must change reed tone");
  assert.deepEqual(eco, before, "presentation may not mutate ecosystem state");
  view.dispose();
});

test("wildlife presentation exposes behavioral state through per-instance color", () => {
  const parent = new THREE.Group(),
    view = new HabitatView(parent),
    body = createBody(-6, -15, 0),
    color = new THREE.Color(),
    wildlife = {
      actors: [
        {
          kind: "prey",
          slot: 0,
          x: -6,
          z: -15,
          yaw: 0,
          mode: "parched",
          phase: 0,
        },
        {
          kind: "predator",
          slot: 0,
          x: -3,
          z: -15,
          yaw: 0,
          mode: "ambush",
          phase: 0,
        },
      ],
    };

  view.update(
    ecosystem(),
    body,
    1,
    null,
    wildlife,
    null,
    1 / 60,
    { windStrength: 0.2, wetness: 0.3 },
  );

  view.animals.getColorAt(0, color);
  assert.equal(color.getHex(), view.preyColors.parched.getHex());
  view.predators.getColorAt(0, color);
  assert.equal(color.getHex(), view.predatorColors.ambush.getHex());
  view.dispose();
});


test("wildlife posture exposes alarm and ambush states, not only color", () => {
  const parent = new THREE.Group(),
    view = new HabitatView(parent),
    body = createBody(-6, -15, 0),
    preyHeadForage = new THREE.Matrix4(),
    preyHeadAlarm = new THREE.Matrix4(),
    predatorWatch = new THREE.Matrix4(),
    predatorAmbush = new THREE.Matrix4();

  const prey = {
      kind: "prey",
      slot: 0,
      x: -6,
      z: -15,
      yaw: 0,
      mode: "forage",
      phase: 0,
    },
    predator = {
      kind: "predator",
      slot: 0,
      x: -3,
      z: -15,
      yaw: 0,
      mode: "watch",
      phase: 0,
    },
    wildlife = { actors: [prey, predator] };

  view.update(
    ecosystem(),
    body,
    1,
    null,
    wildlife,
    null,
    1 / 60,
    { windStrength: 0.2, wetness: 0.5 },
  );
  view.preyHeads.getMatrixAt(0, preyHeadForage);
  view.predators.getMatrixAt(0, predatorWatch);

  prey.mode = "flee";
  predator.mode = "ambush";
  view.update(
    ecosystem(),
    body,
    1.2,
    null,
    wildlife,
    null,
    1 / 60,
    { windStrength: 0.2, wetness: 0.5 },
  );
  view.preyHeads.getMatrixAt(0, preyHeadAlarm);
  view.predators.getMatrixAt(0, predatorAmbush);

  const forageY = new THREE.Vector3().setFromMatrixPosition(preyHeadForage).y,
    alarmY = new THREE.Vector3().setFromMatrixPosition(preyHeadAlarm).y,
    watchY = new THREE.Vector3().setFromMatrixPosition(predatorWatch).y,
    ambushY = new THREE.Vector3().setFromMatrixPosition(predatorAmbush).y;
  assert.ok(alarmY > forageY + 0.04, "fleeing prey must lift its head/body posture");
  assert.ok(ambushY < watchY - 0.06, "ambushing predators must crouch visibly");
  view.dispose();
});


test("nearby movement physically parts reeds while still preserving ecosystem authority", () => {
  const parent = new THREE.Group(),
    view = new HabitatView(parent),
    eco = ecosystem(),
    before = { ...eco },
    body = createBody(-5, -15, 0),
    wildlife = { actors: [] },
    still = new THREE.Matrix4(),
    brushed = new THREE.Matrix4();

  body.vx = 0;
  view.update(
    eco,
    body,
    2,
    null,
    wildlife,
    null,
    1 / 60,
    { windStrength: 0.2, windX: 1, windZ: 0, wetness: 0.6 },
  );
  view.reeds.getMatrixAt(0, still);

  body.vx = 2.2;
  view.update(
    eco,
    body,
    2,
    null,
    wildlife,
    null,
    1 / 60,
    { windStrength: 0.2, windX: 1, windZ: 0, wetness: 0.6 },
  );
  view.reeds.getMatrixAt(0, brushed);

  assert.notDeepEqual(
    still.elements,
    brushed.elements,
    "a reed within body distance must bend away from moving Squirtle",
  );
  assert.deepEqual(eco, before, "reed contact stays presentation-only");
  view.dispose();
});

test("the remembered Lab visitor approaches smoothly, hops when familiar, and crouches when afraid", () => {
  const parent = new THREE.Group(),
    view = new HabitatView(parent, { lab: true }),
    body = createBody(3, 0, 0),
    eco = ecosystem(),
    familiar = { marking: 1, familiarity: 0.8, fear: 0.05 },
    target = new THREE.Vector3(3.5, 0, 0);

  view.update(eco, body, 0.2, familiar, null, null, 1 / 60, {
    windStrength: 0.08,
    wetness: 0.6,
  });
  assert.ok(
    view.visitor.position.distanceTo(target) > 0.5,
    "the visitor should approach rather than teleport to its new relationship distance",
  );

  let maxHop = 0;
  for (let i = 1; i <= 120; i++) {
    view.update(eco, body, i / 60, familiar, null, null, 1 / 60, {
      windStrength: 0.08,
      wetness: 0.6,
    });
    maxHop = Math.max(maxHop, view.visitor.position.y);
  }
  assert.ok(maxHop > 0.025, "familiar visitor should show a visible low hop cycle");

  const afraid = { ...familiar, fear: 0.9 };
  for (let i = 0; i < 60; i++)
    view.update(eco, body, 3 + i / 60, afraid, null, null, 1 / 60, {
      windStrength: 0.08,
      wetness: 0.6,
    });
  assert.ok(view.visitor.scale.y < 0.8, "fear should flatten the visitor into a defensive crouch");
  assert.ok(
    Math.hypot(view.visitor.position.x, view.visitor.position.z) > 3.7,
    "fear should push the visitor farther from Squirtle",
  );
  view.dispose();
});
