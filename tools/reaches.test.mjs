import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REACHES,
  REACH_SOURCES,
  WATER_LINE,
  NEAR_REACH_RADIUS,
  traceReach,
  reachAt,
  basinDistance,
  SPRING_SITE,
  LONGEST_REACH,
} from "../src/simulation/reaches.js";
import { heightAt } from "../src/worldgen.js";
import {
  CHANNEL_BOUNDS,
  channelDistance,
  channelHeight,
} from "../src/simulation/channel-terrain.js";
import { PlaceMemory } from "../src/simulation/place-memory.js";
import { WorldState } from "../src/worldstate.js";
import { save, load } from "../src/persistence.js";
const authored = REACHES.filter((r) => !r.cut);
test("every authored reach walks down from the rim into open water", () => {
  assert.equal(
    authored.length,
    REACH_SOURCES.length,
    "no authored anchor was dropped",
  );
  for (const reach of authored) {
    // Some rim banks sit right on the water, so a short route is honest rather
    // than a failure; long ones still have to stay bounded.
    assert.ok(
      reach.length > 3 && reach.length < 60,
      `${reach.id} length ${reach.length}`,
    );
    assert.ok(reach.head.y > 0.5, `${reach.id} starts above the shallows`);
    assert.ok(reach.mouth.y < WATER_LINE, `${reach.id} must end in water`);
    assert.ok(
      basinDistance(reach.mouth.x, reach.mouth.z) <
        basinDistance(reach.head.x, reach.head.z),
      `${reach.id} runs toward the basin`,
    );
    assert.equal(heightAt(reach.head.x, reach.head.z), reach.head.y);
    // Walking a route must not require walking underwater.
    assert.equal(reach.points.filter((p) => p.y < WATER_LINE).length, 1);
  }
  assert.deepEqual(SPRING_SITE, {
    x: LONGEST_REACH.head.x,
    z: LONGEST_REACH.head.z,
  });
  assert.equal(LONGEST_REACH.id, "spring-gully");
});
test("tracing is a pure read of the terrain, so the network cannot drift", () => {
  for (const source of REACH_SOURCES)
    assert.deepEqual(
      traceReach(source),
      traceReach(source),
      `${source.id} must trace identically twice`,
    );
  const rebuilt = REACH_SOURCES.map((s) => traceReach(s)).map((t, i) =>
    t.points.map((p) => [p.x, p.y, p.z]),
  );
  assert.deepEqual(
    authored.map((r) => r.points.map((p) => [p.x, p.y, p.z])),
    rebuilt,
  );
  // The carved bypass is the only route whose ground the player can change.
  assert.equal(REACHES.filter((r) => r.cut).length, 1);
});
test("naming a route never changes the ground under it", () => {
  for (const reach of authored)
    for (const p of reach.points) {
      assert.ok(
        channelDistance(p.x, p.z) > 0.6,
        `${reach.id} passes through the cut strip`,
      );
      for (let stage = 0; stage < 5; stage++)
        assert.equal(channelHeight(p.x, p.z, stage), heightAt(p.x, p.z));
    }
  // The network is read off the immutable base terrain, so the carve bounds stay
  // the small local box the streaming tests depend on.
  assert.ok(CHANNEL_BOUNDS.maxX - CHANNEL_BOUNDS.minX < 6);
  assert.ok(CHANNEL_BOUNDS.maxZ - CHANNEL_BOUNDS.minZ < 3);
});
test("reachAt names the route under foot with real progress and refuses far ground", () => {
  const reach = LONGEST_REACH;
  const atHead = reachAt(reach.head.x, reach.head.z);
  assert.equal(atHead.id, reach.id);
  assert.ok(atHead.toHead < 0.01);
  assert.ok(Math.abs(atHead.toMouth - reach.length) < 0.01);
  const atMouth = reachAt(reach.mouth.x, reach.mouth.z);
  assert.equal(atMouth.id, reach.id);
  assert.ok(atMouth.toMouth < 0.01);
  assert.ok(atMouth.toHead > reach.length * 0.9);
  const middle = reachAt(
    reach.points[Math.floor(reach.points.length / 2)].x,
    reach.points[Math.floor(reach.points.length / 2)].z,
  );
  assert.ok(middle.toMouth + middle.toHead > reach.length * 0.95);
  for (const [x, z] of [
    [0, 0],
    [-6, -15],
    [40, 40],
    [12, -6],
  ])
    assert.equal(reachAt(x, z), null, `(${x},${z}) is not on a reach`);
  const off = reachAt(reach.head.x + 5.5, reach.head.z);
  assert.equal(off, null, "past the radius the ground is just ground");
});
test("routes that run beside each other say so with a measured distance", () => {
  const spur = REACHES.find((r) => r.id === "long-spur");
  assert.equal(spur.near.id, "spring-gully");
  assert.ok(spur.near.distance > 3 && spur.near.distance < 4.5);
  assert.equal(spur.near.joins, false, "3.8 m apart is beside, not joined");
  for (const reach of REACHES) {
    if (!reach.near) continue;
    assert.notEqual(reach.near.id, reach.id);
    assert.ok(reach.near.distance <= NEAR_REACH_RADIUS);
    const other = REACHES.find((r) => r.id === reach.near.id);
    assert.equal(other.near.id, reach.id, "beside is mutual");
    assert.equal(other.name, reach.near.name);
  }
});
test("memory keeps which reaches were walked, caps them and validates them", () => {
  const m = new PlaceMemory();
  const south = REACHES.find((r) => r.id === "south-draw");
  m.observe(
    { x: LONGEST_REACH.head.x, z: LONGEST_REACH.head.z },
    "frontier",
    1,
    {},
  );
  m.observe({ x: south.mouth.x, z: south.mouth.z }, "frontier", 2, {});
  m.observe({ x: 0, z: 0 }, "frontier", 3, {});
  assert.deepEqual(m.reaches, ["spring-gully", "south-draw"]);
  m.observe({ x: 34.2, z: 14.1 }, "frontier", 4, {});
  assert.equal(m.reaches.length, 2, "a reach is recorded once");
  assert.deepEqual(PlaceMemory.restore(m.snapshot(), 1337).reaches, m.reaches);
  assert.deepEqual(
    PlaceMemory.restore(
      { cells: { "0,0": 1 }, places: [], lastEncounter: -1000 },
      1337,
    ).reaches,
    [],
    "memory written before reaches existed still restores",
  );
  for (const reaches of [
    ["not-a-reach"],
    ["south-draw", "south-draw"],
    REACHES.map((r) => r.id).concat(REACHES.map((r) => r.id)),
  ])
    assert.throws(
      () => PlaceMemory.restore({ ...m.snapshot(), reaches }, 1337),
      /followed reaches/,
    );
});
test("followed reaches ride along in a version 6 save", () => {
  const map = new Map(),
    storage = {
      getItem: (k) => map.get(k),
      setItem: (k, v) => map.set(k, v),
      removeItem: (k) => map.delete(k),
    };
  const state = new WorldState();
  state.memory.observe(
    { x: LONGEST_REACH.head.x, z: LONGEST_REACH.head.z },
    "frontier",
    1,
    state.ecosystem,
  );
  const before = state.memory.snapshot();
  assert.deepEqual(before.reaches, ["spring-gully"]);
  assert.equal(save(state, storage, Date.now()).ok, true);
  const restored = new WorldState();
  const result = load(restored, storage, { now: Date.now(), offline: false });
  assert.equal(result.ok, true, result.message);
  assert.deepEqual(restored.memory.snapshot(), before);
});
