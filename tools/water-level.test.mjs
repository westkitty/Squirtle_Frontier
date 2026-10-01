import test from "node:test";
import assert from "node:assert/strict";
import {
  REACH_FLOW_FRACTION,
  WETLAND_PRISTINE,
  WATER_BASE,
  WATER_DRY_DROP,
  WATER_FULL_RISE,
  WATER_PAINT_LIFT,
  WATER_SHORE,
  WATER_SHORELINE,
  WATER_SURFACE_Y,
  reachWaterFraction,
  reachWaterState,
  waterLevelFor,
} from "../src/simulation/water-level.js";
import { REACHES } from "../src/simulation/reaches.js";
import { WorldState } from "../src/worldstate.js";
import { waterAt } from "../src/player/movement-region.js";
import { heightAt } from "../src/worldgen.js";
import { save, load } from "../src/persistence.js";

const step = (state, seconds) => {
  for (let i = 0; i < seconds; i++) state.update(1);
  return state;
};
// Wet cells of the basin at a level, counted on a fixed grid. This is the shoreline the
// player would see and wade, so it is what a level change has to move.
const shoreline = (level) => {
  let wet = 0;
  for (let x = -12; x <= 12; x += 0.5)
    for (let z = -33; z <= 33; z += 0.5) if (waterAt(x, z, level)) wet++;
  return wet;
};

test("an undisturbed basin sits exactly on the line it has always used", () => {
  const state = step(new WorldState(1337), 600);
  assert.equal(state.watershed.nodes[2].wetness, WETLAND_PRISTINE);
  assert.equal(state.waterLevel, WATER_BASE);
  // Nothing that calls the predicate without a level behaves differently either.
  for (const [x, z] of [
    [0, 0],
    [6, 12],
    [-9, 25],
    [3, -20],
  ])
    assert.equal(
      !!waterAt(x, z, state.waterLevel),
      !!waterAt(x, z),
      `shoreline drifted at ${x},${z}`,
    );
});

test("the level is derived from the graph, so it is never saved and always restored", () => {
  let text;
  const storage = {
    setItem: (_, value) => (text = value),
    getItem: () => text,
  };
  const a = new WorldState(1337);
  a.watershed.nodes[1].blockage = 0;
  step(a, 400);
  assert.ok(
    a.waterLevel > WATER_BASE + 0.1,
    "clearing the landslide should flood",
  );
  assert.equal(save(a, storage).ok, true);
  assert.equal(JSON.parse(text).watershed.waterLevel, undefined);
  const b = new WorldState(1337);
  assert.equal(load(b, storage, { offline: false }).ok, true);
  assert.equal(b.waterLevel, a.waterLevel);
});

test("the level rises with supply, never past its bounds", () => {
  let previous = -Infinity;
  for (let w = 0; w <= 1.0001; w += 0.05) {
    const level = waterLevelFor(w);
    assert.ok(level >= WATER_BASE - WATER_DRY_DROP - 1e-9);
    assert.ok(level <= WATER_BASE + WATER_FULL_RISE + 1e-9);
    assert.ok(level >= previous - 1e-9, "level went backwards as supply rose");
    previous = level;
  }
  // Unknown supply is read as an empty wetland, i.e. the lowest the basin may go.
  assert.equal(waterLevelFor(Number.NaN), WATER_BASE - WATER_DRY_DROP);
  assert.equal(waterLevelFor(undefined), WATER_BASE - WATER_DRY_DROP);
  assert.equal(waterLevelFor(1), WATER_BASE + WATER_FULL_RISE);
});

test("supply decides the shoreline: flood the basin, then drain it", () => {
  const pristine = step(new WorldState(1337), 600);
  const repaired = step(Object.assign(new WorldState(1337), { unused: 0 }), 1);
  repaired.watershed.nodes[1].blockage = 0;
  step(repaired, 600);
  assert.ok(repaired.waterLevel > pristine.waterLevel + 0.15);
  assert.ok(
    shoreline(repaired.waterLevel) > shoreline(pristine.waterLevel) + 100,
    "a fed wetland has to show on the shore",
  );

  const drained = step(new WorldState(1337), 1);
  drained.watershed.nodes[1].blockage = 0;
  step(drained, 600);
  drained.frontier.bypass = 1;
  drained.frontier.channelErosion = 12;
  step(drained, 1800);
  assert.ok(
    drained.waterLevel < repaired.waterLevel - 0.02,
    "an opened side route has to take water off the basin",
  );
  assert.ok(
    shoreline(drained.waterLevel) < shoreline(repaired.waterLevel),
    "and that has to uncover shore",
  );
});

test("the painted surface and the wade line keep one rim width", () => {
  for (const wetness of [0, 0.05, 0.4, 0.8, 1]) {
    const level = waterLevelFor(wetness);
    assert.ok(
      Math.abs(
        WATER_SURFACE_Y(level) -
          WATER_SHORELINE(level) -
          (WATER_PAINT_LIFT + WATER_SHORE),
      ) < 1e-12,
    );
  }
});

test("the paint may shimmer, but never wider than the rim it sits on", () => {
  // The algebra above is true for any pair of constants, which is worth little: what makes
  // the shallows read as water rather than as a flood is these two numbers and their order.
  assert.equal(WATER_PAINT_LIFT, 0.015, "1.5 cm of lift is the authored look");
  assert.equal(
    WATER_SHORE,
    0.05,
    "5 cm of ground stays walkable under the surface",
  );
  assert.ok(
    WATER_PAINT_LIFT < WATER_SHORE,
    "ground must never look like water by more than a third of the rim",
  );
  // And the lift is measured from the surface, not from the shoreline it floats over.
  // The level is quantised to six decimals, so this compares within a nanometre rather
  // than bit for bit - the same tolerance the rim-width test above uses.
  for (const wetness of [0, 0.05, 0.4, 1])
    assert.ok(
      Math.abs(
        WATER_SURFACE_Y(waterLevelFor(wetness)) -
          waterLevelFor(wetness) -
          WATER_PAINT_LIFT,
      ) < 1e-12,
    );
});

test("the surface the body floats on is the level, not the shoreline", () => {
  const level = waterLevelFor(0.8);
  const water = waterAt(0, 0, level);
  assert.ok(water);
  assert.equal(water.level, level);
  // A point between the shoreline and the surface is still walkable ground by design,
  // which is what keeps the rim the width it has always been.
  let gap = 0;
  for (let x = -10; x <= 10; x += 0.1)
    for (let z = -31; z <= 31; z += 0.1) {
      const h = heightAt(x, z);
      if (h >= WATER_SHORELINE(level) && h < level) gap++;
    }
  assert.ok(gap > 0);
});

test("reach water is measured through the predicate the body trusts", () => {
  const level = waterLevelFor(0.8);
  for (const reach of REACHES) {
    const before = JSON.stringify(reach);
    const probe = (x, z) => !!waterAt(x, z, level);
    let manual = 0;
    for (let i = 1; i < reach.points.length - 1; i++)
      if (probe(reach.points[i].x, reach.points[i].z)) manual++;
    assert.equal(
      reachWaterFraction(reach, probe),
      manual / (reach.points.length - 2),
    );
    assert.equal(
      JSON.stringify(reach),
      before,
      "measurement mutated the network",
    );
  }
});

test("a pool at the mouth is not a running channel", () => {
  const fake = { points: [{}, { x: 0, z: 0 }, { x: 0, z: 2 }, {}] };
  assert.equal(
    reachWaterFraction(fake, (x, z) => z === 0),
    0.5,
  );
  assert.equal(reachWaterState(fake, (x, z) => z === 0).flowing, true);
  assert.equal(reachWaterState({ points: [] }, () => true).fraction, 0);
  assert.equal(reachWaterState(fake, () => true).flowing, true);
  assert.equal(reachWaterState(fake, () => false).flowing, false);
  assert.ok(REACH_FLOW_FRACTION > 0 && REACH_FLOW_FRACTION < 1);
});

test("the gullies answer to the basin, and so does the cut you made", () => {
  const at = (wetness) => {
    const level = waterLevelFor(wetness);
    return (id) =>
      reachWaterFraction(
        REACHES.find((r) => r.id === id),
        (x, z) => !!waterAt(x, z, level),
      );
  };
  const dry = at(WETLAND_PRISTINE),
    wet = at(0.8);
  // A natural inflow shows nothing until the basin is fed, because nothing feeds it.
  assert.equal(dry("spring-gully"), 0);
  assert.equal(wet("spring-gully"), 0);
  // The player's groove is below the shoreline the moment it is cut, and drains as the
  // basin drops: that is the level talking, not a label.
  assert.ok(dry("drainage-groove") > 0);
  assert.ok(wet("drainage-groove") > dry("drainage-groove"));
  assert.ok(at(0.44)("drainage-groove") < wet("drainage-groove"));
  assert.ok(wet("basin-door") >= REACH_FLOW_FRACTION);
});
