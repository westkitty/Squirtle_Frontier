import { test } from "node:test";
import assert from "node:assert/strict";
import { Watershed } from "../src/simulation/watershed.js";
import { WorldState } from "../src/worldstate.js";
import { save, load } from "../src/persistence.js";
const advance = (w, seconds) => {
  for (let i = 0; i < seconds * 60; i++) w.update(1 / 60);
};
test("blockage restricts downstream flow; physical effort propagates wetness and staged channel development", () => {
  const w = new Watershed();
  advance(w, 30);
  const before = w.nodes[2].wetness;
  assert.ok(w.nodes[2].flow < 0.051);
  for (let i = 0; i < 10; i++) w.clearDebris("landslide", 0.1);
  advance(w, 300);
  assert.equal(w.nodes[2].flow, 1);
  assert.ok(w.nodes[2].wetness > before + 0.8);
  assert.equal(w.nodes[1].stage, 4);
  assert.equal(w.nodes[1].restoration, 1);
  assert.equal(w.clearDebris("wetland", 1), false);
});
test("graph and propagation continue identically after semantic save/load", () => {
  const a = new WorldState();
  a.watershed.clearDebris("landslide", 0.1);
  advance(a, 5);
  let text;
  const store = { setItem: (_, v) => (text = v), getItem: () => text };
  assert.equal(save(a, store).ok, true);
  const b = new WorldState();
  assert.equal(load(b, store).ok, true);
  advance(a, 10);
  advance(b, 10);
  assert.deepEqual(a.snapshot(), b.snapshot());
});
test("bad topology, cyclic links and invalid scalars reject atomically; version one migrates", () => {
  const state = new WorldState(),
    before = state.snapshot();
  for (const mutate of [
    (s) => (s.watershed[1].downstream = ["spring"]),
    (s) => (s.watershed[0].flow = -1),
    (s) => (s.watershed = null),
  ]) {
    const damaged = structuredClone(before);
    mutate(damaged);
    const text = JSON.stringify(damaged);
    assert.equal(load(state, { getItem: () => text }).ok, false);
    assert.deepEqual(state.snapshot(), before);
  }
  const legacy = {
    version: 1,
    seed: state.seed,
    elapsed: 10,
    player: { x: 1, z: 2 },
  };
  assert.equal(load(state, { getItem: () => JSON.stringify(legacy) }).ok, true);
  assert.equal(state.elapsed, 10);
  assert.equal(state.version, 2);
});
test("bounded steps and deterministic semantic snapshots", () => {
  const a = new Watershed(),
    b = new Watershed();
  advance(a, 60);
  advance(b, 60);
  assert.deepEqual(a.snapshot(), b.snapshot());
  for (const dt of [-1, NaN, Infinity, 2]) assert.throws(() => a.update(dt));
  assert.ok(!JSON.stringify(a.snapshot()).includes("uuid"));
});

import {
  applyWaterJet,
  senseWater,
  DEBRIS_SITE,
} from "../src/simulation/water-interaction.js";
test("repair requires nearby active jet aimed at debris; sense requires water", () => {
  const w = new Watershed(),
    b = {
      x: DEBRIS_SITE.x,
      z: DEBRIS_SITE.z + 2,
      y: 0,
      yaw: Math.PI,
      jetTime: 0.2,
    };
  assert.equal(applyWaterJet(w, { ...b, jetTime: 0 }, 1 / 60), false);
  assert.equal(applyWaterJet(w, { ...b, yaw: 0 }, 1 / 60), false);
  assert.equal(applyWaterJet(w, { ...b, z: 50 }, 1 / 60), false);
  assert.equal(applyWaterJet(w, b, 1 / 60), true);
  assert.ok(w.nodes[1].blockage < 0.95);
  assert.equal(senseWater(w, b, false), null);
  assert.ok(senseWater(w, b, true).strength > 0);
});
