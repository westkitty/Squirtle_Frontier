import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NearWildlife,
  WILDLIFE_HOME,
  waterQuality,
} from "../src/simulation/near-wildlife.js";
import { PlaceMemory } from "../src/simulation/place-memory.js";
import { WorldState } from "../src/worldstate.js";
import { save, load } from "../src/persistence.js";
// Water in a ring 4-7 m around the home patch: an edge to drink at, land inside it.
const ring = (x, z) => {
  const d = Math.hypot(x - WILDLIFE_HOME.x, z - WILDLIFE_HOME.z);
  return d > 4 && d < 7 ? { level: 0 } : null;
};
const clean = { wetness: 0.9, contamination: 0, sediment: 0 };
const herd = (seed = 1337, water = ring, drinkQuality = clean) => ({
  wildlife: new NearWildlife(seed),
  env: { obstacles: [], water, drinkQuality },
  // Observer stands on dry ground north of the patch: inside the activity
  // radius, outside the flushing radius.
  body: { x: -6, z: -5, vx: 0, vz: 0, jetTime: 0, mode: "land" },
  eco: { prey: 1, predators: 0 },
});
const run = (h, steps, each) => {
  for (let i = 0; i < steps; i++) {
    each?.(h, i);
    h.wildlife.step(1 / 60, h.body, "frontier", h.eco, h.env);
  }
  return h;
};
test("thirst drives the herd to a wet edge, and drinking quenches it", () => {
  const h = herd();
  assert.equal(h.wildlife.waterIssue, null, "clean wet shallows are usable");
  const seen = [];
  run(h, 1500, (s) => {
    for (const a of s.wildlife.actors)
      if (a.mode === "drink") seen.push({ x: a.x, z: a.z, thirst: a.thirst });
  });
  assert.ok(
    seen.length > 30,
    `expected sustained drinking, saw ${seen.length}`,
  );
  const site = h.wildlife.sites[0];
  assert.ok(h.wildlife.sites.length >= 8, "the ring should offer many edges");
  for (const d of seen) {
    const near = Math.min(
      ...h.wildlife.sites.map((s) => Math.hypot(d.x - s.x, d.z - s.z)),
    );
    assert.ok(
      near < 1.2,
      `a drinker should be at its site, was ${near} m away`,
    );
  }
  const quelled = h.wildlife.actors.filter((a) => a.thirst < 0.55).length;
  assert.ok(quelled >= 6, `drinking should quench thirst, ${quelled} quenched`);
  assert.ok(site && ring(site.x, site.z), "sites must be water");
  // Drinking never leaves the territory, so the herd stays findable.
  for (const a of h.wildlife.actors)
    assert.ok(
      Math.hypot(a.x - WILDLIFE_HOME.x, a.z - WILDLIFE_HOME.z) <= 7.01,
      "actors stay leashed to home",
    );
});
test("fouled or vanished shallows stop drinking and read as pacing", () => {
  assert.ok(waterQuality(clean) > 0.99);
  assert.ok(
    waterQuality({ wetness: 1, contamination: 0.9, sediment: 0 }) < 0.15,
  );
  const fouled = run(
    herd(1337, ring, { wetness: 0.9, contamination: 0.9, sediment: 0.4 }),
    1500,
  );
  assert.equal(
    fouled.wildlife.actors.some((a) => a.mode === "drink"),
    false,
    "nobody drinks at poisoned water",
  );
  assert.equal(fouled.wildlife.parched, true);
  assert.equal(fouled.wildlife.drinkers.length, 0);
  // Mid-drink abort: an animal that was drinking when the water fouled does not
  // keep drinking it.
  const interrupted = herd();
  run(interrupted, 1200);
  const midDrink = interrupted.wildlife.actors.find((a) => a.drink > 0);
  assert.ok(midDrink, "fixture should catch an animal mid-drink");
  Object.assign(midDrink, { mode: "drink", drink: 2 });
  interrupted.env.drinkQuality = {
    wetness: 0.9,
    contamination: 0.95,
    sediment: 0,
  };
  interrupted.wildlife.step(
    1 / 60,
    interrupted.body,
    "frontier",
    interrupted.eco,
    interrupted.env,
  );
  assert.equal(midDrink.drink, 0, "the drink is abandoned");
  assert.notEqual(midDrink.mode, "drink");
  assert.ok(fouled.wildlife.actors.every((a) => a.thirst > 0.8));
  const dry = run(herd(1337, null), 1500);
  assert.equal(dry.wildlife.sites.length, 0);
  assert.equal(dry.wildlife.waterIssue, "gone");
  const baked = run(
    herd(1337, ring, { wetness: 0.05, contamination: 0, sediment: 0 }),
    1500,
  );
  assert.equal(
    baked.wildlife.actors.some((a) => a.mode === "drink"),
    false,
  );
  assert.equal(baked.wildlife.waterIssue, "dry");
  assert.equal(fouled.wildlife.waterIssue, "fouled");
  assert.equal(
    dry.wildlife.actors.some((a) => a.mode === "drink"),
    false,
  );
  assert.equal(dry.wildlife.parched, true);
  // Pacing is still motion: a parched animal is not frozen.
  const pacer = dry.wildlife.actors.find((a) => a.mode === "parched");
  assert.ok(pacer && Math.hypot(pacer.vx, pacer.vz) > 0.1);
});
test("a flush interrupts a drink instead of queueing one", () => {
  const h = herd();
  run(h, 1200, (s, i) => {
    if (i > 600) {
      const drinker = s.wildlife.actors.find((a) => a.mode === "drink");
      if (drinker)
        s.body = { ...drinker, vx: 0, vz: 0, jetTime: 1, mode: "land" };
    }
  });
  assert.equal(
    h.wildlife.actors.some((a) => a.mode === "drink"),
    false,
    "jets at the water's edge empty the shore",
  );
  assert.equal(
    h.wildlife.actors.some((a) => a.mode === "evade"),
    true,
  );
  assert.ok(h.wildlife.actors.every((a) => a.drink === 0));
});
test("predators commit to committed drinkers", () => {
  const h = herd(1337, ring, clean);
  h.eco = { prey: 1, predators: 1 };
  h.wildlife.step(1 / 60, h.body, "frontier", h.eco, h.env);
  // Put one animal mid-drink and one hunter on the far side of the patch.
  const prey = h.wildlife.actors.find((a) => a.kind === "prey");
  const hunter = h.wildlife.actors.find((a) => a.kind === "predator");
  const site = h.wildlife.sites[0];
  Object.assign(prey, { x: site.x, z: site.z, mode: "drink", drink: 2 });
  for (const a of h.wildlife.actors)
    if (a.kind === "prey" && a !== prey) a.x = WILDLIFE_HOME.x - 6;
  Object.assign(hunter, { x: WILDLIFE_HOME.x + 6, z: WILDLIFE_HOME.z + 4 });
  const distance = (a) => Math.hypot(site.x - a.x, site.z - a.z);
  const startDistance = distance(hunter);
  let ambushed = 0;
  for (let i = 0; i < 240; i++) {
    h.wildlife.step(1 / 60, h.body, "frontier", h.eco, h.env);
    // The drinker is pinned so the approach is measurable rather than a chase.
    Object.assign(
      h.wildlife.actors.find((a) => a.slot === prey.slot),
      {
        x: site.x,
        z: site.z,
        mode: "drink",
        drink: 2,
      },
    );
    if (h.wildlife.actors.find((a) => a.kind === "predator").mode === "ambush")
      ambushed++;
  }
  assert.ok(
    ambushed > 0,
    "a stalking predator should commit as ambush near a drinker",
  );
  const now = distance(h.wildlife.actors.find((a) => a.kind === "predator"));
  assert.ok(now < startDistance, "the hunter closes on the drinking animal");
});
test("herd decisions are deterministic per seed and independent of frame order", () => {
  const a = run(herd(1337), 900);
  const b = run(herd(1337), 900);
  assert.deepEqual(
    a.wildlife.actors.map((x) => [x.kind, x.slot, x.x, x.z, x.mode]),
    b.wildlife.actors.map((x) => [x.kind, x.slot, x.x, x.z, x.mode]),
  );
  const c = run(herd(9999), 900);
  assert.notDeepEqual(
    a.wildlife.actors.map((x) => [x.x, x.z]),
    c.wildlife.actors.map((x) => [x.x, x.z]),
  );
  // Reversing the actor array must not change decisions taken from the snapshot.
  const d = new NearWildlife(1337);
  d.step(1 / 60, a.body, "frontier", a.eco, a.env);
  d.actors.reverse();
  const e = new NearWildlife(1337);
  e.step(1 / 60, a.body, "frontier", a.eco, a.env);
  const key = (l) =>
    l
      .map((x) => `${x.kind}${x.slot}:${x.mode}`)
      .sort()
      .join("|");
  assert.equal(key(d.actors), key(e.actors));
});
test("drink tracks record what was seen here, capped and validated", () => {
  const m = new PlaceMemory();
  m.noteDrinks({ x: -6, z: -15 }, [
    { x: -6, z: -15 },
    { x: -6.5, z: -15.5 },
    { x: 60, z: 60 },
  ]);
  assert.equal(
    Object.keys(m.drinks).length,
    2,
    "only nearby sites are observed",
  );
  for (let i = 0; i < 400; i++)
    m.noteDrinks({ x: -6, z: -15 }, [{ x: -6, z: -15 }]);
  assert.equal(m.drinks["-2,-3"], 255, "counts saturate");
  for (let i = 0; i < 40; i++)
    m.noteDrinks({ x: -6, z: -15 }, [{ x: i * 3 - 30, z: i * 3 - 30 }]);
  assert.ok(Object.keys(m.drinks).length <= 200, "the track map stays bounded");
  const round = PlaceMemory.restore(m.snapshot(), 1337);
  assert.deepEqual(round.snapshot(), m.snapshot());
  assert.deepEqual(
    PlaceMemory.restore(
      { cells: { "0,0": 1 }, places: [], lastEncounter: -1000 },
      1337,
    ).drinks,
    {},
    "memory written before drink tracks still restores",
  );
  assert.throws(
    () =>
      PlaceMemory.restore({ ...m.snapshot(), drinks: { "99,99": 1 } }, 1337),
    /drink track/,
  );
  assert.throws(
    () =>
      PlaceMemory.restore({ ...m.snapshot(), drinks: { "0,0": 1.5 } }, 1337),
    /drink track/,
  );
  assert.throws(
    () =>
      PlaceMemory.restore(
        {
          ...m.snapshot(),
          drinks: Object.fromEntries(
            Array.from({ length: 201 }, (_, i) => [`${i % 20},${i}`, 1]),
          ),
        },
        1337,
      ),
    /drink track/,
  );
});
test("drink tracks ride along in a version 6 save", () => {
  const map = new Map(),
    storage = {
      getItem: (k) => map.get(k),
      setItem: (k, v) => map.set(k, v),
      removeItem: (k) => map.delete(k),
    };
  const state = new WorldState();
  state.memory.observe({ x: -6, z: -15 }, "frontier", 1, state.ecosystem);
  state.memory.noteDrinks({ x: -6, z: -15 }, [{ x: -6, z: -15 }]);
  const before = state.memory.snapshot();
  assert.ok(before.drinks && Object.keys(before.drinks).length === 1);
  save(state, storage, Date.now());
  const fresh = new WorldState();
  const result = load(fresh, storage, { now: Date.now(), offline: false });
  assert.equal(result.ok, true, result.message);
  assert.deepEqual(fresh.memory.snapshot(), before);
});
