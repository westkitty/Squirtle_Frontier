import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NearWildlife,
  MAX_PREY,
  MAX_PREDATORS,
  WILDLIFE_HOME,
} from "../src/simulation/near-wildlife.js";
import { Settlement, WATER_HOUSE } from "../src/simulation/settlement.js";
import { WorldState } from "../src/worldstate.js";
import { save, load, advanceOffline, SAVE_KEY } from "../src/persistence.js";
const env = { obstacles: [] };
const observer = { x: -6, z: -5, vx: 0, vz: 0, jetTime: 0, mode: "land" };
const eco = { prey: 1, predators: 1 };
test("near actors follow aggregate budgets, despawn outside radius and never enter saved state", () => {
  const w = new NearWildlife();
  w.step(1 / 60, observer, "frontier", eco, env);
  assert.equal(w.actors.length, MAX_PREY + MAX_PREDATORS);
  w.step(1 / 60, observer, "frontier", { prey: 0.2, predators: 0 }, env);
  assert.equal(w.actors.length, 2);
  w.step(1 / 60, { ...observer, x: 60 }, "frontier", eco, env);
  assert.equal(w.actors.length, 0);
  w.step(1 / 60, observer, "lab", eco, env);
  assert.equal(w.actors.length, 0);
  assert.equal("actors" in new WorldState().snapshot(), false);
});
test("prey evade player and predators while predators stalk instead of orbiting", () => {
  const w = new NearWildlife();
  w.step(1 / 60, observer, "frontier", eco, env);
  const prey = w.actors.find((a) => a.kind === "prey"),
    hunter = w.actors.find((a) => a.kind === "predator");
  Object.assign(prey, { x: -6, z: -15 });
  Object.assign(hunter, { x: -5, z: -15 });
  w.step(1 / 60, observer, "frontier", eco, env);
  assert.equal(prey.mode, "flee");
  assert.ok(prey.vx < 0);
  assert.equal(hunter.mode, "stalk");
  const player = { ...observer, x: prey.x, z: prey.z + 1 };
  w.step(1 / 60, player, "frontier", eco, env);
  assert.equal(prey.mode, "evade");
  assert.ok(prey.vz < 0);
});
test("local simulation repeats deterministically with bounded positions and obstacle separation", () => {
  const a = new NearWildlife(),
    b = new NearWildlife();
  const obstacle = { x: -6, z: -15, radius: 0.5, height: 2 };
  for (let i = 0; i < 3600; i++) {
    for (const w of [a, b])
      w.step(1 / 60, observer, "frontier", eco, { obstacles: [obstacle] });
  }
  assert.deepEqual(a.actors, b.actors);
  for (const actor of a.actors) {
    assert.ok(Math.hypot(actor.x + 6, actor.z + 15) >= 0.68 - 1e-9);
    for (const key of ["x", "z", "vx", "vz", "yaw"])
      assert.ok(Number.isFinite(actor[key]));
  }
});
test("settlement counts distinct visits, learns calm presence, withdraws from jets and allocates bowl water", () => {
  const s = new Settlement(),
    body = { ...observer, x: WATER_HOUSE.x + 3, z: WATER_HOUSE.z + 3 };
  for (let i = 0; i < 70; i++) s.observe(body, "frontier", i);
  assert.equal(s.visits, 1);
  assert.ok(s.familiarity >= 0.25);
  s.observe(body, "lab", 71);
  s.observe(body, "frontier", 72);
  assert.equal(s.visits, 2);
  const e = { cistern: 0.8 };
  s.tick(e);
  assert.ok(s.bowl > 0);
  assert.ok(e.cistern < 0.8);
  for (let i = 73; i < 80; i++)
    s.observe({ ...body, jetTime: 0.2 }, "frontier", i);
  assert.equal(s.response, "withdraw");
  const dry = new Settlement();
  dry.familiarity = 1;
  dry.tick({ cistern: 0 });
  assert.equal(dry.bowl, 0);
});
test("settlement survives save and offline time cannot award familiarity or visits; v4 migrates", () => {
  const a = new WorldState(),
    body = { ...observer, x: -12, z: -9 };
  for (let i = 0; i < 70; i++) a.settlement.observe(body, "frontier", i);
  const m = new Map(),
    storage = { getItem: (k) => m.get(k), setItem: (k, v) => m.set(k, v) };
  save(a, storage, 0);
  const b = new WorldState();
  assert.equal(load(b, storage, { offline: false }).ok, true);
  assert.deepEqual(b.snapshot(), a.snapshot());
  const memory = b.settlement.familiarity,
    visits = b.settlement.visits;
  advanceOffline(b, 600);
  assert.equal(b.settlement.familiarity, memory);
  assert.equal(b.settlement.visits, visits);
  const old = JSON.parse(m.get(SAVE_KEY));
  old.version = 4;
  delete old.settlement;
  m.set(SAVE_KEY, JSON.stringify(old));
  const c = new WorldState();
  assert.equal(load(c, storage, { offline: false }).ok, true);
  assert.equal(c.settlement.visits, 0);
  const bad = {
    ...b.snapshot(),
    savedAt: 0,
    settlement: { ...b.settlement.snapshot(), fear: NaN },
  };
  const before = c.snapshot();
  assert.equal(
    load(c, { getItem: () => JSON.stringify(bad) }, { offline: false }).ok,
    false,
  );
  assert.deepEqual(c.snapshot(), before);
});
