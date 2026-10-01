import { test } from "node:test";
import assert from "node:assert/strict";
import { Ecosystem } from "../src/simulation/ecosystem.js";
import { Watershed } from "../src/simulation/watershed.js";

// The documented colonisation contract (README, docs/qa/HABITAT_RETURN.md): outlet
// allocation informs Lab water renewal, Lab reeds/insects and *sustained* eligibility
// precede deterministic seed-dependent frog arrival. These tests own that contract the
// way the mutation harness demands: each one names a rule that must fail when inverted.
//
// Causes are legal watershed states, never hand-edited ecosystem scalars: the gate
// inputs are recomputed by Ecosystem.tick every second, so only the watershed the
// ecosystem is fed from can honestly turn them.

const year = (watershed, ecosystem, ticks) => {
  for (let i = 0; i < ticks; i++) {
    watershed.update(1);
    ecosystem.tick(watershed);
  }
};
const repaired = () => {
  const ws = new Watershed();
  for (let i = 0; i < 10; i++) ws.clearDebris("landslide", 0.1);
  return ws;
};

test("a repaired watershed puts the basin on the colonisation clock and arrives at frogs", () => {
  const ws = repaired(),
    eco = new Ecosystem();
  year(ws, eco, 900);
  assert.ok(
    eco.eligibleSeconds > 180,
    `a fed basin must hold eligibility, held ${eco.eligibleSeconds}`,
  );
  assert.ok(
    eco.labFrogs > 0.1,
    `sustained eligibility must arrive at frogs, got ${eco.labFrogs}`,
  );
});

test("an unfed basin is off the colonisation clock: no water renewal, no arrival", () => {
  // Cause one: the landslide re-slides. Within a bounded window the basin's water
  // renewal is the only gate input that has fallen (the reed-side scalars drain on
  // slower time constants), so this window is what pins the water rung by name.
  const dry = repaired(),
    dryEco = new Ecosystem();
  year(dry, dryEco, 900);
  assert.ok(dryEco.eligibleSeconds >= 180, "the basin must start on the clock");
  dry.nodes[1].blockage = 0.95;
  year(dry, dryEco, 70);
  assert.ok(
    dryEco.labWater < 0.5,
    "a re-blocked landslide must starve the basin's water renewal",
  );
  assert.ok(
    dryEco.labReeds > 0.35 && dryEco.labInsects > 0.25 && dryEco.prey > 0.2,
    "the window must isolate water: the reed-side gates are still lit",
  );
  assert.equal(
    dryEco.eligibleSeconds,
    0,
    "a basin whose water renewal has failed must be off the clock",
  );
  // Cause two: the spring itself stops. Every gate input drains in the end, and the
  // clock must never run on a dead watershed.
  const dead = repaired(),
    deadEco = new Ecosystem();
  dead.nodes[0].blockage = 1;
  year(dead, deadEco, 900);
  assert.equal(
    deadEco.eligibleSeconds,
    0,
    "a dead watershed must never put the basin on the clock",
  );
  assert.equal(deadEco.labFrogs, 0, "a dead watershed must never arrive at frogs");
});

test("a lapse in eligibility discards the colonisation clock; progress is re-earned", () => {
  const ws = repaired(),
    eco = new Ecosystem();
  year(ws, eco, 900);
  const before = eco.eligibleSeconds;
  assert.ok(before >= 180, "the saturated basin must be on the clock first");
  // The landslide re-slides long enough for every gate input to drain: eligibility
  // lapses and the clock holds empty for the rest of the blockage.
  ws.nodes[1].blockage = 0.95;
  year(ws, eco, 300);
  assert.equal(
    eco.eligibleSeconds,
    0,
    "a lapse in eligibility must discard the colonisation clock",
  );
  // Repair again through the real mechanic: the clock restarts from nothing, so even
  // after full recovery it is still far short of what the lapse threw away.
  for (let i = 0; i < 10; i++) ws.clearDebris("landslide", 0.1);
  year(ws, eco, 360);
  assert.ok(
    eco.eligibleSeconds < before,
    `regained eligibility must re-earn the clock: ${eco.eligibleSeconds} after a lapse from ${before}`,
  );
});

test("frog arrival is delayed past the first minute of eligibility, and is seed-dependent", () => {
  // Drive arrival timing through the same watershed the eligibility grew on.
  const timed = (seed) => {
    const ws = repaired(),
      eco = new Ecosystem(seed);
    let start = null;
    for (let i = 0; i < 600 && start === null; i++) {
      ws.update(1);
      eco.tick(ws);
      if (eco.eligibleSeconds === 1) start = i;
    }
    assert.ok(start !== null, "a repaired watershed must become eligible");
    for (let i = 0; i < 110; i++) {
      ws.update(1);
      eco.tick(ws);
    }
    assert.equal(
      eco.labFrogs,
      0,
      "no seed may arrive within 110 ticks of first eligibility",
    );
    let arrived = null;
    for (let i = 0; i < 200 && arrived === null; i++) {
      ws.update(1);
      eco.tick(ws);
      if (eco.labFrogs > 0) arrived = 110 + i;
    }
    assert.ok(
      arrived !== null,
      "every seed must arrive within 310 ticks of first eligibility",
    );
    return arrived;
  };
  const a = timed(1337),
    b = timed(60);
  assert.notEqual(a, b, "arrival must be seed-dependent");
  // Determinism: the same seed replays the same arrival, tick for tick.
  assert.equal(timed(1337), a, "arrival must be deterministic for a seed");
});
