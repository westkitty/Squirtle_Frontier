import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { MovementScenery } from "../src/player/movement-scenery.js";
import { createBody } from "../src/player/body-state.js";

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
