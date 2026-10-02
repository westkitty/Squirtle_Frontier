import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FrontierSystems,
  traceChannel,
  weatherAt,
  fireSite,
} from "../src/simulation/frontier-systems.js";
import { WorldState } from "../src/worldstate.js";
import { PlaceMemory } from "../src/simulation/place-memory.js";
import { deepHistory } from "../src/simulation/deep-history.js";
import { Watershed } from "../src/simulation/watershed.js";
import { advanceOffline, save, load } from "../src/persistence.js";
import { applyWorldJet } from "../src/simulation/water-interaction.js";
import { aimFromYaw } from "../src/beam.js";
test("weather/fire regional clock is exact online/offline across block boundaries", () => {
  for (const n of [179, 180, 181, 601]) {
    const a = new WorldState(),
      b = new WorldState();
    a.frontier.heat[5] = b.frontier.heat[5] = 0.8;
    for (let i = 0; i < n * 60; i++) a.update(1 / 60);
    advanceOffline(b, n);
    assert.deepEqual(a.frontier.snapshot(), b.frontier.snapshot());
    assert.deepEqual(a.watershed.snapshot(), b.watershed.snapshot());
  }
});
test("bypass conserves source flow but trades wetland access for outlet supply", () => {
  const a = new Watershed(),
    b = new Watershed();
  a.update(1);
  b.update(1, { diversion: 0.45 });
  assert.ok(b.nodes[3].flow > a.nodes[3].flow);
  for (const w of [a, b])
    for (let i = 0; i < 10; i++) w.clearDebris("landslide", 0.1);
  a.update(1);
  b.update(1, { diversion: 0.45 });
  assert.ok(b.nodes[2].flow < a.nodes[2].flow);
  assert.ok(Math.abs(b.nodes[3].flow - a.nodes[3].flow) < 1e-12);
});
test("channel route descends and fire suppression retains wetness", () => {
  const points = traceChannel();
  assert.ok(points.length > 3);
  for (let i = 1; i < points.length; i++)
    assert.ok(points[i].y < points[i - 1].y);
  const a = new FrontierSystems(),
    b = new FrontierSystems();
  a.heat[5] = b.heat[5] = 0.8;
  b.soaked[5] = 1;
  for (let i = 0; i < 20; i++) {
    a.advance();
    b.advance();
  }
  assert.ok(b.heat[5] < a.heat[5]);
});
test("observation never happens offline; one Lab arrival persists identity and relationship", () => {
  const s = new WorldState();
  s.ecosystem.labFrogs = 0.5;
  const body = { x: 0, z: 4, vx: 0, vz: 0, jetTime: 0 };
  s.memory.observe(body, "lab", 1, s.ecosystem);
  s.memory.observe(body, "lab", 61, s.ecosystem);
  const before = s.memory.snapshot();
  advanceOffline(s, 500);
  assert.deepEqual(s.memory.snapshot(), before);
  assert.equal(before.notable.encounters, 2);
  assert.ok(before.notable.familiarity > 0);
  const restored = PlaceMemory.restore(before, s.seed);
  assert.deepEqual(restored.snapshot(), before);
});
test("exploration is bounded, malformed map/fire rejects and history is reproducible", () => {
  const m = new PlaceMemory();
  m.observe({ x: -10, z: 18 }, "frontier", 1, {});
  assert.equal(Object.keys(m.cells).length, 1);
  assert.ok(m.places.includes("bank"));
  // A cell beyond the world's own edge is rejected. Cells far from spawn are not: the
  // survey grid spans the valley, so the validator's bound is the world's, and a save that
  // remembered ground at 500 m is a save worth having.
  assert.throws(
    () =>
      PlaceMemory.restore({ ...m.snapshot(), cells: { "999,999": 1 } }, 1337),
    /survey cell/,
  );
  assert.deepEqual(
    PlaceMemory.restore({ ...m.snapshot(), cells: { "99,99": 1 } }, 1337).cells,
    { "99,99": 1 },
    "a cell 495 m from spawn should be readable ground, not a corrupt save",
  );
  assert.throws(() =>
    FrontierSystems.restore(
      { ...new FrontierSystems().snapshot(), heat: [NaN] },
      1337,
    ),
  );
  assert.deepEqual(deepHistory(1337), deepHistory(1337));
  assert.notDeepEqual(deepHistory(1338), deepHistory(1337));
});
test("v3 migration handles floating elapsed just below tick boundary and mid-frame resume", () => {
  const s = new WorldState();
  for (let i = 0; i < 91; i++) s.update(1 / 60);
  const map = new Map(),
    storage = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) };
  save(s, storage, 1000);
  const b = new WorldState();
  load(b, storage, { offline: false });
  for (let i = 0; i < 311; i++) {
    s.update(1 / 60);
    b.update(1 / 60);
  }
  assert.deepEqual(s.snapshot(), b.snapshot());
  const legacy = {
    ...s.snapshot(),
    version: 3,
    elapsed: 179.99999999999998,
    ecoRemainder: 0,
    savedAt: 1000,
  };
  storage.setItem("squirtle_frontier_baseline_v1", JSON.stringify(legacy));
  const c = new WorldState();
  assert.equal(load(c, storage, { offline: false }).ok, true);
  assert.equal(c.frontier.tick, 180);
});

import {
  replaceSave,
  recoverBackup,
  QUARANTINE_KEY,
  SAVE_KEY,
  BACKUP_KEY,
} from "../src/persistence.js";
test("explicit import validates before replacement; recovery preserves damaged primary bytes", () => {
  const s = new WorldState(),
    m = new Map(),
    storage = {
      getItem: (k) => m.get(k) ?? null,
      setItem: (k, v) => m.set(k, v),
    };
  save(s, storage, 1);
  const valid = m.get(SAVE_KEY);
  m.set(SAVE_KEY, "broken");
  m.set(BACKUP_KEY, valid);
  assert.equal(replaceSave(s, storage, "{no").ok, false);
  assert.equal(m.get(SAVE_KEY), "broken");
  assert.equal(recoverBackup(s, storage).ok, true);
  assert.equal(m.get(QUARANTINE_KEY), "broken");
  assert.equal(m.get(SAVE_KEY), valid);
  const blocked = {
    getItem: (k) => m.get(k),
    setItem: () => {
      throw new Error("quota");
    },
  };
  assert.equal(replaceSave(s, blocked, valid).ok, false);
  assert.equal(m.get(SAVE_KEY), valid);
});

import { placeAction } from "../src/simulation/place-interaction.js";
import { recordRegion, DeepRecord } from "../src/player/deep-record.js";
import { createBody } from "../src/player/body-state.js";
import { stepBody } from "../src/player/squirtle-controller.js";
import * as THREE from "three";
test("record access is spatial/depth gated and actual swim physics reaches historical strata", () => {
  assert.equal(placeAction("lab", { x: 0, z: 0, y: -1.1 }), "record");
  assert.equal(placeAction("lab", { x: 0, z: 0, y: 0 }), null);
  assert.equal(placeAction("record", { y: -8 }), null);
  assert.equal(placeAction("record", { y: -0.2 }), "record-exit");
  const b = createBody(0, 0, -0.3);
  b.grounded = false;
  b.mode = "swim";
  for (let i = 0; i < 300; i++)
    stepBody(b, { x: 0, z: 0, dive: true }, recordRegion, 1 / 60);
  assert.ok(b.y < -8);
  const scene = new THREE.Scene(),
    view = new DeepRecord(scene, 1337);
  assert.match(view.describe(b.y), /years ago/);
  view.dispose();
  assert.equal(scene.children.length, 0);
});

test("Water Jet aimed at burnt ground rinses ash and prevents storm contamination", () => {
  const frontier = new FrontierSystems(1337);
  const site = fireSite(0);
  frontier.heat[0] = 0.6;
  frontier.ash[0] = 0.8;
  frontier.soaked[0] = 0;

  // Body positioned 1.2m south of site 0, facing North (+Z direction toward site)
  // site.x is 12, site.z is -8
  const body = createBody(site.x, site.z - 1.2, 0);
  body.yaw = 0; // facing +Z direction (toward site.z)
  body.jetTime = 0.35;

  // 1. Direct aimed Water Jet rinses ash and cools heat
  applyWorldJet(frontier, body, 0.5, aimFromYaw(body.yaw, body));
  assert.ok(frontier.heat[0] < 0.6, "water jet must cool fire heat");
  assert.ok(frontier.soaked[0] > 0, "water jet must soak ground");
  assert.ok(frontier.ash[0] < 0.8, "water jet must rinse away ash");

  // 2. Unaimed water jet (facing opposite direction Math.PI) fails to hit site
  const ashBefore = frontier.ash[0];
  body.yaw = Math.PI; // facing south away from site
  applyWorldJet(frontier, body, 0.5, aimFromYaw(Math.PI, body));
  assert.equal(frontier.ash[0], ashBefore, "unaimed jet must not affect ash");
});

test("6-hour offline fast-forward maintains finite bounded scalars and history limit", () => {
  const s = new WorldState();
  // 6 hours = 21,600 ticks
  const result = advanceOffline(s, 21600);
  assert.equal(result.seconds, 21600);
  assert.equal(result.capped, false);
  assert.equal(s.frontier.tick, 21600);

  // All 16 fire cells remain strictly normalized in [0, 1]
  for (let i = 0; i < 16; i++) {
    assert.ok(
      Number.isFinite(s.frontier.heat[i]) &&
        s.frontier.heat[i] >= 0 &&
        s.frontier.heat[i] <= 1,
      `heat[${i}] must be bounded in [0, 1]`,
    );
    assert.ok(
      Number.isFinite(s.frontier.fuel[i]) &&
        s.frontier.fuel[i] >= 0 &&
        s.frontier.fuel[i] <= 1,
      `fuel[${i}] must be bounded in [0, 1]`,
    );
    assert.ok(
      Number.isFinite(s.frontier.ash[i]) &&
        s.frontier.ash[i] >= 0 &&
        s.frontier.ash[i] <= 1,
      `ash[${i}] must be bounded in [0, 1]`,
    );
    assert.ok(
      Number.isFinite(s.frontier.soaked[i]) &&
        s.frontier.soaked[i] >= 0 &&
        s.frontier.soaked[i] <= 1,
      `soaked[${i}] must be bounded in [0, 1]`,
    );
  }

  // History is strictly capped at 90 entries
  assert.ok(s.frontier.history.length <= 90);
  assert.ok(s.frontier.channelErosion <= 120);
});
