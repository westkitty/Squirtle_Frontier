import test from "node:test";
import assert from "node:assert/strict";
import {
  createJetHitEvent,
  emitJetHit,
  resetJetHitEvent,
} from "../src/simulation/jet-hit.js";

test("Jet-hit event reuses one record and advances serial once per simulation step", () => {
  const event = createJetHitEvent(),
    identity = event;
  assert.equal(event.serial, 0);
  assert.equal(event.active, false);

  emitJetHit(event, "fire", 1, 2, 3, 0.8, 4);
  assert.equal(event, identity);
  assert.deepEqual(
    {
      serial: event.serial,
      active: event.active,
      kind: event.kind,
      x: event.x,
      y: event.y,
      z: event.z,
      intensity: event.intensity,
      index: event.index,
    },
    {
      serial: 1,
      active: true,
      kind: "fire",
      x: 1,
      y: 2,
      z: 3,
      intensity: 0.8,
      index: 4,
    },
  );

  emitJetHit(event, "ground", 8, 9, 10, 0.2, 2);
  assert.equal(event.serial, 1, "one fixed step emits one presentation event");
  assert.equal(event.kind, "fire", "weaker secondary contacts may not steal the event");

  resetJetHitEvent(event);
  assert.equal(event, identity);
  assert.equal(event.active, false);
  assert.equal(event.serial, 1, "reset preserves the last serial for subscribers");

  emitJetHit(event, "ash", 5, 6, 7, 2, 1);
  assert.equal(event.serial, 2);
  assert.equal(event.kind, "ash");
  assert.equal(event.intensity, 1, "intensity is clamped");
});
