import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveAttentionTarget,
  ATTENTION_RADIUS,
  ATTENTION_FOV,
  OMNI_PROXIMITY,
} from "../src/player/creature-attention.js";
import { createBody } from "../src/player/body-state.js";

test("attention target resolution prioritizes living wildlife over static landmarks", () => {
  const body = createBody(-10, 10, 0);
  body.yaw = 0; // Facing +Z

  const state = {
    frontier: { heat: Array(16).fill(0) },
    memory: {},
  };

  const wildlife = {
    actors: [
      { kind: "prey", slot: 0, x: -10, z: 14 }, // 4m ahead, priority 10
    ],
  };

  const target = resolveAttentionTarget({
    body,
    place: "frontier",
    state,
    wildlife,
  });

  assert.ok(target, "should resolve an attention target");
  assert.equal(target.type, "wildlife");
  assert.equal(target.priority, 10);
  assert.equal(target.id, "wildlife-prey-0");
});

test("attention targets behind Squirtle outside field of view are ignored unless in close omni-proximity", () => {
  const body = createBody(0, 0, 0);
  body.yaw = 0; // Facing +Z

  const wildlife = {
    actors: [
      // Directly behind at 5m: outside OMNI_PROXIMITY (2.4m) and outside FOV (1.2 rad)
      { kind: "prey", slot: 1, x: 0, z: -5 },
    ],
  };

  const targetBehind = resolveAttentionTarget({
    body,
    place: "frontier",
    wildlife,
  });
  assert.equal(targetBehind, null, "target behind and beyond omni-proximity must be ignored");

  // Directly behind at 1.5m: within OMNI_PROXIMITY
  wildlife.actors[0].z = -1.5;
  const targetClose = resolveAttentionTarget({
    body,
    place: "frontier",
    wildlife,
  });
  assert.ok(targetClose, "target in close proximity should be noticed even if behind");
  assert.equal(targetClose.id, "wildlife-prey-1");
});

test("attention targets beyond maximum radius are ignored", () => {
  const body = createBody(0, 0, 0);
  body.yaw = 0; // Facing +Z

  const wildlife = {
    actors: [
      // 15m ahead: exceeds 9m radius for wildlife
      { kind: "prey", slot: 0, x: 0, z: 15 },
    ],
  };

  const target = resolveAttentionTarget({
    body,
    place: "frontier",
    wildlife,
  });
  assert.equal(target, null, "distant target must be ignored");
});

test("active fire hazard draws attention when nearby", () => {
  const body = createBody(12, -7, 0); // Near fireSite(0) at (12, -8)
  body.yaw = -Math.PI / 2; // Facing +X

  const state = {
    frontier: {
      heat: Array(16).fill(0),
    },
  };
  state.frontier.heat[0] = 0.8; // Active burning fire

  const target = resolveAttentionTarget({
    body,
    place: "frontier",
    state,
  });

  assert.ok(target, "should attend to active fire");
  assert.equal(target.type, "fire");
  assert.equal(target.priority, 8);
});

test("settlement caretaker and filled bowl are attended according to settlement state", () => {
  const body = createBody(-14, -10, 0); // Near settlement (-15, -12)
  body.yaw = -Math.PI / 2;

  const settlement = {
    response: "watch",
    bowl: 0.8, // Bowl has water!
  };

  const target = resolveAttentionTarget({
    body,
    place: "frontier",
    settlement,
  });

  assert.ok(target, "should resolve settlement attention");
  // Filled bowl has priority 7 vs caretaker priority 6
  assert.equal(target.type, "bowl");
  assert.equal(target.id, "settlement-bowl");

  // When bowl is empty, attention shifts to caretaker
  settlement.bowl = 0;
  const targetCaretaker = resolveAttentionTarget({
    body,
    place: "frontier",
    settlement,
  });
  assert.equal(targetCaretaker.type, "caretaker");
  assert.equal(targetCaretaker.id, "settlement-caretaker");

  // When caretaker is withdrawn, no caretaker target is produced
  settlement.response = "withdraw";
  const targetWithdrawn = resolveAttentionTarget({
    body,
    place: "frontier",
    settlement,
  });
  assert.equal(targetWithdrawn, null);
});

test("Lab environment attends to marked visitor frog and central basin", () => {
  const body = createBody(0, 3, 0);
  body.yaw = Math.PI; // Facing -Z (toward basin at 0, 0)

  const state = {
    memory: {
      notable: {
        marking: 1,
        familiarity: 0.5,
      },
    },
  };

  const target = resolveAttentionTarget({
    body,
    place: "lab",
    state,
  });

  assert.ok(target);
  assert.equal(target.type, "wildlife");
  assert.equal(target.id, "lab-frog");
});

test("Deep Record attends to central strata column", () => {
  const body = createBody(2, 2, -10);
  body.yaw = -Math.PI * 0.75; // Facing toward (0, 0)

  const target = resolveAttentionTarget({
    body,
    place: "record",
  });

  assert.ok(target);
  assert.equal(target.type, "record");
  assert.equal(target.id, "record-column");
});


test("attention holds a nearly equal current target instead of snapping every frame", () => {
  const body = createBody(0, 0, 0);
  body.yaw = 0;
  const wildlife = {
    actors: [
      { kind: "prey", slot: 0, x: -0.3, z: 4, mode: "forage" },
      { kind: "prey", slot: 1, x: 0.2, z: 3.7, mode: "forage" },
    ],
  };
  const previous = {
    id: "wildlife-prey-0",
    type: "wildlife",
    priority: 10,
  };
  const held = resolveAttentionTarget({
    body,
    place: "frontier",
    wildlife,
    previous,
  });
  assert.equal(
    held.id,
    previous.id,
    "small distance advantages must not cause visible gaze thrash",
  );

  wildlife.actors[1].z = 1.8;
  const switched = resolveAttentionTarget({
    body,
    place: "frontier",
    wildlife,
    previous,
  });
  assert.equal(
    switched.id,
    "wildlife-prey-1",
    "a materially stronger spatial signal must still break fixation",
  );
});

test("behavioral salience lets an ambushing predator override ordinary nearby prey", () => {
  const body = createBody(0, 0, 0);
  body.yaw = 0;
  const wildlife = {
    actors: [
      { kind: "prey", slot: 0, x: 0, z: 2.5, mode: "forage" },
      { kind: "predator", slot: 0, x: 0.5, z: 6, mode: "ambush" },
    ],
  };

  const target = resolveAttentionTarget({
    body,
    place: "frontier",
    wildlife,
  });
  assert.equal(target.id, "wildlife-predator-0");
  assert.equal(target.priority, 13);
});
