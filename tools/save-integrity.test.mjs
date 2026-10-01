import { test } from "node:test";
import assert from "node:assert/strict";
import { WorldState } from "../src/worldstate.js";
import { createBody } from "../src/player/body-state.js";
import {
  save,
  load,
  advanceOffline,
  commitSave,
  commitWithLock,
  adoptStoredWorld,
  SAVE_KEY,
  LOCK_KEY,
} from "../src/persistence.js";

const storage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
  };
};
const setNavigator = (value) =>
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    writable: true,
    value,
  });

test("place-scoped pose round-trips and an unsafe pose rejects the save", () => {
  const st = storage();
  const a = new WorldState();
  a.pose = { x: 1.5, y: -0.9, z: -2.5, yaw: 0.7, place: "lab" };
  a.player = { x: 1.5, z: -2.5 };
  assert.equal(save(a, st, Date.now()).ok, true);
  const b = new WorldState();
  assert.equal(load(b, st, { offline: false }).ok, true);
  assert.deepEqual(b.pose, a.pose);
  for (const pose of [
    { x: 0, y: -9000, z: 0, yaw: 0, place: "record" },
    { x: 0, y: 0, z: 0, yaw: NaN, place: "lab" },
    { x: 9000, y: 0, z: 0, yaw: 0, place: "lab" },
  ]) {
    const bad = { ...JSON.parse(st.getItem(SAVE_KEY)), pose };
    const before = b.snapshot();
    assert.equal(
      load(b, { getItem: () => JSON.stringify(bad) }, { offline: false }).ok,
      false,
      "an out-of-range pose must reject, not partly apply",
    );
    assert.deepEqual(b.snapshot(), before);
  }
  // A v5 save simply has no pose; the older x/z placement path keeps working.
  const legacy = { ...JSON.parse(st.getItem(SAVE_KEY)), version: 5 };
  delete legacy.pose;
  const d = new WorldState();
  assert.equal(
    load(d, { getItem: () => JSON.stringify(legacy) }, { offline: false }).ok,
    true,
  );
  assert.equal(d.pose, null);
  assert.ok(Number.isFinite(createBody(d.player.x, d.player.z, 0).y));
});

test("web locks serialize read-modify-write so two tabs cannot interleave", async () => {
  const st = storage();
  let inside = 0,
    overlaps = 0,
    requests = 0,
    queue = Promise.resolve();
  // A queue mirrors Web Locks: the callback only starts once the holder ends.
  setNavigator({
    locks: {
      request: (name, opts, fn) => {
        assert.equal(name, LOCK_KEY);
        assert.equal(opts.mode, "exclusive");
        requests++;
        queue = queue.then(async () => {
          inside++;
          if (inside > 1) overlaps++;
          // Give the other tab a real chance to interleave inside the section.
          await new Promise((r) => setTimeout(r, 5));
          try {
            return await fn();
          } finally {
            inside--;
          }
        });
        return queue;
      },
    },
  });
  try {
    const a = new WorldState(),
      b = new WorldState();
    load(a, st, { offline: false });
    load(b, st, { offline: false });
    advanceOffline(a, 5);
    advanceOffline(b, 3);
    const results = await Promise.all([
      commitSave(a, st, Date.now()),
      commitSave(b, st, Date.now() + 1),
    ]);
    assert.equal(requests, 2);
    assert.equal(overlaps, 0, "the lock must serialize");
    const stored = JSON.parse(st.getItem(SAVE_KEY));
    assert.equal(results.filter((r) => r.ok).length, 1, "one writer wins");
    assert.equal(stored.elapsed, Math.max(a.elapsed, b.elapsed));
    assert.match(results.find((r) => !r.ok).message, /another tab/);
    assert.equal(overlaps, 0);
    // Without Web Locks the same call still performs the write.
    setNavigator(undefined);
    assert.equal(
      (await commitWithLock(() => save(a, st, Date.now()))).ok,
      true,
    );
  } finally {
    setNavigator(undefined);
  }
});

test("a blocked tab can adopt the newer generation without rewriting storage", () => {
  const st = storage(),
    now = Date.now();
  const driver = new WorldState(),
    follower = new WorldState();
  load(driver, st, { offline: false });
  load(follower, st, { offline: false });
  advanceOffline(driver, 120);
  driver.pose = { x: -8, y: 0.2, z: 14, yaw: 2, place: "frontier" };
  assert.equal(save(driver, st, now).ok, true);
  const newer = st.getItem(SAVE_KEY);
  assert.equal(save(follower, st, now + 1).ok, false);
  assert.equal(st.getItem(SAVE_KEY), newer, "a refused write cannot clobber");
  follower.pose = { x: 3, y: 0.2, z: -4, yaw: 1, place: "frontier" };
  const result = adoptStoredWorld(follower, st);
  assert.equal(result.ok, true);
  assert.equal(follower.persistenceBlocked, false);
  assert.equal(follower.elapsed, driver.elapsed);
  assert.deepEqual(follower.pose, driver.pose);
  assert.equal(
    st.getItem(SAVE_KEY),
    newer,
    "adoption is a read, not a rewrite",
  );
  // After adopting, the tab is current and may save again.
  advanceOffline(follower, 1);
  assert.equal(save(follower, st, now + 2000).ok, true);
  assert.ok(JSON.parse(st.getItem(SAVE_KEY)).elapsed >= driver.elapsed);
});
