import { test } from "node:test";
import assert from "node:assert/strict";
import { WorldState } from "../src/worldstate.js";
import {
  save,
  load,
  advanceOffline,
  SAVE_KEY,
  BACKUP_KEY,
  MAX_OFFLINE_SECONDS,
} from "../src/persistence.js";
const storage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};
const repaired = () => {
  const s = new WorldState();
  for (let i = 0; i < 10; i++) s.watershed.clearDebris("landslide", 0.1);
  return s;
};
test("flow repair drives delayed wetland, prey/predator, cistern and Lab colonization", () => {
  const a = repaired(),
    b = new WorldState();
  advanceOffline(a, 1800);
  advanceOffline(b, 1800);
  for (const key of [
    "reeds",
    "insects",
    "prey",
    "predators",
    "cistern",
    "labWater",
    "labReeds",
    "labInsects",
    "labFrogs",
  ])
    assert.ok(a.ecosystem[key] > b.ecosystem[key] + 0.05, key);
  assert.ok(a.ecosystem.predators < a.ecosystem.prey);
  assert.ok(a.ecosystem.labFrogs > 0);
  const c = repaired();
  advanceOffline(c, 100);
  assert.equal(c.ecosystem.labFrogs, 0);
});
test("online fixed steps and offline tick replay give identical causal state", () => {
  const a = repaired(),
    b = repaired();
  for (let i = 0; i < 600 * 60; i++) a.update(1 / 60);
  advanceOffline(b, 600);
  assert.deepEqual(a.watershed.snapshot(), b.watershed.snapshot());
  assert.deepEqual(a.ecosystem.snapshot(), b.ecosystem.snapshot());
  assert.equal(a.ecoRemainder, b.ecoRemainder);
});
test("timestamp consumption prevents duplicate offline return; clock rollback and cap bounded", () => {
  const st = storage(),
    a = repaired();
  assert.equal(save(a, st, 100000).ok, true);
  const b = new WorldState();
  const result = load(b, st, { now: 700000 });
  assert.equal(result.seconds, 600);
  const c = new WorldState();
  load(c, st, { now: 700000 });
  assert.deepEqual(c.snapshot(), b.snapshot());
  const d = new WorldState();
  assert.equal(load(d, st, { now: 600000 }).seconds, 0);
  assert.deepEqual(advanceOffline(d, 1e8), {
    seconds: MAX_OFFLINE_SECONDS,
    capped: true,
  });
});
test("malformed primary recovers backup read-only; bad ecosystem never partly applies", () => {
  const st = storage(),
    a = repaired();
  save(a, st, 0);
  a.update(1);
  save(a, st, 1000);
  const backup = st.getItem(BACKUP_KEY);
  st.setItem(SAVE_KEY, "{broken");
  const b = new WorldState();
  assert.equal(load(b, st, { now: 2000 }).recovered, true);
  assert.equal(save(b, st).ok, false);
  assert.equal(st.getItem(SAVE_KEY), "{broken");
  assert.equal(st.getItem(BACKUP_KEY), backup);
  const bad = JSON.parse(backup);
  bad.ecosystem.labFrogs = -1;
  st.setItem(SAVE_KEY, JSON.stringify(bad));
  st.setItem(BACKUP_KEY, "broken");
  const c = new WorldState(),
    before = c.snapshot();
  assert.equal(load(c, st).ok, false);
  assert.deepEqual(c.snapshot(), before);
});
test("stale tab cannot overwrite a newer generation; old schemas have no retroactive offline grant", () => {
  const st = storage(),
    a = repaired();
  save(a, st, 0);
  const b = new WorldState();
  load(b, st, { offline: false });
  a.update(1);
  save(a, st, 1000);
  assert.equal(save(b, st, 2000).ok, false);
  const legacy = {
    version: 2,
    seed: a.seed,
    elapsed: 5,
    player: { x: 0, z: 0 },
    watershed: a.watershed.snapshot(),
  };
  st.setItem(SAVE_KEY, JSON.stringify(legacy));
  const c = new WorldState();
  assert.equal(load(c, st, { now: 1e9 }).seconds, 0);
  assert.equal(c.elapsed, 5);
});

test("future timestamp is retained after rollback, not replayed when the clock catches up", () => {
  const st = storage(),
    a = repaired();
  save(a, st, 500000);
  const b = new WorldState();
  load(b, st, { now: 100000 });
  assert.equal(JSON.parse(st.getItem(SAVE_KEY)).savedAt, 500000);
  const c = new WorldState();
  assert.equal(load(c, st, { now: 500000 }).seconds, 0);
  assert.equal(c.elapsed, 0);
});
