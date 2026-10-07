import test from "node:test";
import assert from "node:assert/strict";
import {
  JET_HIT_LIFETIME,
  createJetHit,
  markJetHit,
  stepJetHit,
} from "../src/player/jet-hit.js";

test("Jet hit record is reusable, bounded and expires without allocation", () => {
  const hit = createJetHit(),
    same = hit;
  assert.equal(hit.active, false);
  assert.equal(markJetHit(hit, "fire", 1, 2, 3, 2), true);
  assert.equal(hit, same);
  assert.equal(hit.active, true);
  assert.equal(hit.kind, "fire");
  assert.equal(hit.intensity, 1);
  assert.equal(hit.time, JET_HIT_LIFETIME);
  const serial = hit.serial;

  markJetHit(hit, "fire", 1.05, 2, 3, 0.5);
  assert.equal(hit.serial, serial, "continuous contact keeps one event identity");
  assert.equal(hit.intensity, 0.5);

  markJetHit(hit, "debris", 5, 2, 3, 0.9);
  assert.ok(hit.serial > serial, "new target/type advances event identity");
  stepJetHit(hit, JET_HIT_LIFETIME + 0.01);
  assert.equal(hit.active, false);
  assert.equal(hit.kind, "none");
  assert.equal(hit.intensity, 0);
});
