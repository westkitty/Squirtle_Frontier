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
  assert.equal(load(b, store, { offline: false }).ok, true);
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
    const damaged = { ...structuredClone(before), savedAt: 0 };
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
  assert.equal(
    load(state, { getItem: () => JSON.stringify(legacy) }, { offline: false })
      .ok,
    true,
  );
  assert.equal(state.elapsed, 10);
  assert.equal(state.version, 6);
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
import { aimFromYaw } from "../src/beam.js";
test("repair requires nearby active jet aimed at debris; sense requires water", () => {
  // The aim is the authority, so the test builds one with it rather than handing the
  // mechanic a body heading and hoping they agree.
  const w = new Watershed(),
    aimAt = (body) => aimFromYaw(body.yaw, body),
    b = {
      x: DEBRIS_SITE.x,
      z: DEBRIS_SITE.z + 2,
      y: 0,
      yaw: Math.PI,
      jetTime: 0.2,
    };
  assert.equal(applyWaterJet(w, { ...b, jetTime: 0 }, 1 / 60, aimAt(b)), false);
  const away = { ...b, yaw: 0 };
  assert.equal(applyWaterJet(w, away, 1 / 60, aimAt(away)), false);
  const far = { ...b, z: 50 };
  assert.equal(applyWaterJet(w, far, 1 / 60, aimAt(far)), false);
  assert.equal(applyWaterJet(w, b, 1 / 60, aimAt(b)), true);
  assert.equal(
    applyWaterJet(w, b, 1 / 60, null),
    false,
    "no aim authority, no shot",
  );
  assert.ok(w.nodes[1].blockage < 0.95);
  assert.equal(senseWater(w, b, false), null);
  assert.ok(senseWater(w, b, true).strength > 0);
});
