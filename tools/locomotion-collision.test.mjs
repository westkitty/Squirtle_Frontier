// Locomotion Zero, stage 8: contact response and the end of the prototype box.
//
// The claims worth testing are the ones a player can feel: a body must never end a step
// inside a trunk, a wall should be slid along rather than stuck to or bounced off, a
// graze must not shake the camera, contact must not add speed, and the world has to end
// where the terrain does rather than at a hand-typed radius.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBody } from "../src/player/body-state.js";
import { stepBody } from "../src/player/squirtle-controller.js";
import { CONTACT } from "../src/player/locomotion-states.js";
import {
  obstaclesAt,
  sampleGround,
  waterAt,
  region,
} from "../src/player/movement-region.js";
import { heightAt, WORLD, PLAYABLE_BOUND, RIM_START } from "../src/worldgen.js";

const DT = 1 / 60;
const rock = (x, z, radius = 0.3, height = 2) => ({ x, z, radius, height });
const flat = (obstacles = []) => ({
  sample: () => ({ height: 0, dx: 0, dz: 0 }),
  water: () => null,
  obstacles,
});
const outside = (b, o) =>
  Math.hypot(b.x - o.x, b.z - o.z) >= o.radius + CONTACT.bodyRadius - 1e-6;

test("a body sprinting at a trunk is never inside it, at any cadence", () => {
  const trunk = rock(0, 6, 0.6, 8);
  for (const dt of [DT, 1 / 30, 1 / 20, 1 / 144]) {
    const b = createBody(0, 0, 0);
    b.yaw = 0;
    const seen = [];
    const env = {
      sample: sampleGround,
      water: (x, z) => waterAt(x, z, 0),
      obstaclesAt: (x, z) => {
        seen.push([x, z]);
        return [trunk];
      },
    };
    let closest = Infinity,
      penetration = 0;
    for (let i = 0; i < Math.ceil(2 / dt); i++) {
      stepBody(b, { x: 0, z: 1 }, env, dt);
      const d = Math.hypot(b.x - trunk.x, b.z - trunk.z);
      if (d < trunk.radius) penetration++;
      closest = Math.min(closest, d);
    }
    assert.equal(
      penetration,
      0,
      `the body passed through the trunk at dt ${dt}`,
    );
    assert.ok(
      outside(b, trunk),
      `the body came to rest inside the trunk at dt ${dt}`,
    );
    // Held at the stand-off radius while the player pushes is correct. Getting past the
    // trunk's own surface is not, and that is what a step-long query used to allow.
    assert.ok(
      closest >= trunk.radius - 1e-6,
      `the body got within ${closest.toFixed(3)} m of the centre at dt ${dt}`,
    );
    // Both the cell left and the cell reached are consulted, so the arrival step is the
    // resolved one rather than the step after it.
    assert.ok(seen.length > 2, "contacts were barely looked up");
  }
});

test("a real chunk boundary cannot hide a collider from the arriving step", () => {
  // The region caches colliders per 24 m cell, which is exactly where a query pinned to
  // the previous position starts to matter.
  const b = createBody(0, 200, 0);
  b.yaw = 0;
  const env = {
    sample: sampleGround,
    water: (x, z) => waterAt(x, z, 0),
    obstaclesAt,
  };
  let deepest = 0;
  for (let i = 0; i < 60 * 40; i++) {
    stepBody(b, { x: 0, z: 1 }, env, DT);
    for (const o of obstaclesAt(b.x, b.z))
      if (b.y < sampleGround(b.x, b.z).height + o.height)
        deepest = Math.max(
          deepest,
          o.radius + CONTACT.bodyRadius - Math.hypot(b.x - o.x, b.z - o.z),
        );
  }
  assert.ok(
    deepest <= 1e-6,
    `the body ended a step ${deepest.toFixed(3)} m inside a collider`,
  );
  assert.ok(
    b.z > 205,
    `the walk stalled after ${b.z.toFixed(1)} m of progress`,
  );
});

test("a wall is slid along, not stuck to and not thrown clear of", () => {
  const wall = rock(0, 3, 1.8, 6),
    R = wall.radius + CONTACT.bodyRadius;
  const b = createBody(-1.6, 0, 0);
  b.vz = 4.5;
  b.vx = 0.5;
  let path = 0,
    px = b.x,
    pz = b.z,
    contact = 0,
    deepest = 0,
    peak = 0,
    outwardPeak = 0;
  for (let i = 0; i < 60; i++) {
    stepBody(b, { x: 0.35, z: 1 }, flat([wall]), DT);
    path += Math.hypot(b.x - px, b.z - pz);
    px = b.x;
    pz = b.z;
    const dx = b.x - wall.x,
      dz = b.z - wall.z,
      d = Math.hypot(dx, dz);
    deepest = Math.max(deepest, R - d);
    if (d <= R + 1e-3) {
      contact++;
      outwardPeak = Math.max(outwardPeak, (b.vx * dx + b.vz * dz) / (d || 1));
    }
    peak = Math.max(peak, Math.hypot(b.vx, b.vz));
    assert.ok(Number.isFinite(b.x) && Number.isFinite(b.z));
  }
  assert.ok(
    deepest < 0.01,
    `the body penetrated the wall by ${deepest.toFixed(3)} m`,
  );
  // Held pressure into the wall takes the inward component away every step, so the body
  // stays near the surface and slides: it neither sinks in nor is bounced clear of it,
  // which is what a body leaning on a bank should do.
  assert.ok(contact > 15, `contact was intermittent (${contact}/60 frames)`);
  assert.ok(path > 0.4, "a body pressed along a wall stopped moving entirely");
  assert.ok(
    Math.hypot(b.vx, b.vz) <= peak + 1e-6,
    "contact gave the body speed",
  );
  assert.ok(
    outwardPeak < 1.5,
    `the wall spat the body back out at ${outwardPeak.toFixed(2)} m/s`,
  );
});

test("a graze is silent, a hit is bounded, a fast arrival still bounces", () => {
  const trunk = rock(0, 2, 0.5, 6);
  const graze = createBody(-1.9, 0.6, 0);
  graze.vz = 6;
  graze.vx = 0.2;
  for (let i = 0; i < 15; i++)
    stepBody(graze, { x: 0, z: 0 }, flat([trunk]), DT);
  assert.ok(
    graze.impact < 0.2,
    `a near miss registered ${graze.impact.toFixed(2)}`,
  );

  const headOn = createBody(0, 0.9, 0);
  headOn.vz = 26; // far above anything the game can produce; the cap has it at 12
  let maxImpact = 0,
    bounced = 0;
  for (let i = 0; i < 20; i++) {
    stepBody(headOn, { x: 0, z: 1 }, flat([trunk]), DT);
    maxImpact = Math.max(maxImpact, headOn.impact);
    bounced = Math.min(bounced, headOn.vz);
  }
  assert.ok(
    maxImpact <= 1 + 1e-9,
    `impact exceeded full strength (${maxImpact.toFixed(3)})`,
  );
  assert.ok(
    maxImpact > 0.5,
    `a slab of a hit registered ${maxImpact.toFixed(2)}`,
  );
  assert.ok(
    bounced < -1,
    "a fast head-on arrival should be thrown back off it",
  );

  const creep = createBody(0, 1.3, 0);
  creep.vz = 0.4; // under the graze threshold
  for (let i = 0; i < 12; i++)
    stepBody(creep, { x: 0, z: 0 }, flat([trunk]), DT);
  assert.equal(creep.impact, 0, "creeping into a trunk should be silent");
  assert.ok(creep.vz >= 0, "a press should not be answered with a push back");
});

test("contact cannot give the body more speed than it arrived with", () => {
  const trunk = rock(0, 1.0, 0.4, 4);
  const b = createBody(0, 0, 0);
  let peak = 0;
  for (let i = 0; i < 300; i++) {
    // Held forward pressure plus periodic bursts: the case that used to pump a body.
    stepBody(b, { x: 0, z: 1, jet: i % 24 === 0 }, flat([trunk]), DT);
    peak = Math.max(peak, Math.hypot(b.vx, b.vz));
    assert.ok(outside(b, trunk), `frame ${i}: inside the trunk`);
    assert.ok(
      Number.isFinite(b.vx) &&
        Number.isFinite(b.vz) &&
        Math.hypot(b.vx, b.vz) <= 12.01,
      `frame ${i}: velocity left the simulation's bounds`,
    );
  }
  assert.ok(
    Math.hypot(b.vx, b.vz) <= peak + 1e-6,
    "the body accelerated out of contact",
  );
});

test("a wedged body finds a way out instead of being resolved into both", () => {
  const a = rock(0, 2, 0.9, 4),
    b = rock(0.9, 2.5, 0.9, 4);
  const body = createBody(0.45, 1.0, 0);
  body.vz = 8;
  for (let i = 0; i < 72; i++) stepBody(body, { x: 0, z: 1 }, flat([a, b]), DT);
  assert.ok(outside(body, a), "still overlapping the first");
  assert.ok(outside(body, b), "the second pass did not resolve");
  assert.ok(Number.isFinite(body.x) && Number.isFinite(body.z));
});

test("the playable bound is the terrain's rim, not a prototype box", () => {
  assert.equal(
    PLAYABLE_BOUND,
    Math.floor(WORLD.half * RIM_START),
    "the limit must come from the world's own geometry",
  );
  assert.ok(PLAYABLE_BOUND > 70, "the prototype box is still in force");
  assert.ok(
    PLAYABLE_BOUND < WORLD.half - 60,
    "the bound is outside the generated world",
  );
  // Outside the bound the ground climbs by more than 40 m within 200 m -- a slope the
  // body's own step limit refuses. The edge of the play area is therefore the edge of
  // the walkable map, not an invisible wall placed inside it.
  const at = heightAt(0, PLAYABLE_BOUND),
    beyond = heightAt(0, PLAYABLE_BOUND + 200);
  assert.ok(
    beyond > at + 40,
    `the ground does not climb outside the bound: ${at.toFixed(1)} m there, ${beyond.toFixed(1)} m 200 m out`,
  );
});

test("a body can walk past the old 70 m box and is stopped by the rim", () => {
  const env = {
    ...region,
    sample: sampleGround,
    water: (x, z) => waterAt(x, z, 0),
    obstaclesAt,
  };
  const b = createBody(0, 0, 0);
  b.yaw = 0;
  let farthest = 0;
  for (let i = 0; i < 60 * 30; i++) {
    stepBody(b, { x: 0, z: 1 }, env, DT);
    farthest = Math.max(farthest, b.z);
  }
  assert.ok(
    farthest > 70,
    `the body was still boxed at 70 m (reached ${farthest.toFixed(1)})`,
  );

  // At the rim: pushing outward *and* along it. The outward component is what stops.
  const c = createBody(0, PLAYABLE_BOUND - 6, 0);
  c.yaw = 0;
  for (let i = 0; i < 60 * 40; i++) stepBody(c, { x: 1, z: 1 }, env, DT);
  assert.ok(
    c.z <= PLAYABLE_BOUND + 1e-6,
    `the body leaked through the boundary (${c.z.toFixed(2)})`,
  );
  assert.ok(
    Math.abs(c.x) > 0.5,
    "sliding along the rim should still be possible",
  );

  // And velocity is not left pressed into a wall the position cannot cross: the old code
  // clamped the position and reported the blocked step as travel.
  const held = createBody(0, PLAYABLE_BOUND - 0.5, 0);
  held.yaw = 0;
  for (let i = 0; i < 600; i++) stepBody(held, { x: 0, z: 1 }, env, DT);
  assert.ok(Math.abs(held.vz) < 0.05, "outward velocity survived the boundary");
  assert.ok(
    held.distance < 40,
    "the body was credited with travel it never made",
  );
});

test("a piling in water blocks a swim the way a trunk blocks a walk", () => {
  const piling = rock(0, 2, 0.5, 6);
  const env = {
    sample: () => ({ height: -3, dx: 0, dz: 0 }),
    water: () => ({ level: 0, currentX: 0, currentZ: 0 }),
    obstaclesAt: () => [piling],
  };
  const b = createBody(0, -1.2, 0);
  let clear = 0;
  for (let i = 0; i < 240; i++) {
    stepBody(b, { x: 0.45, z: 1, intent: { x: 0.45, y: 0, z: 1 } }, env, DT);
    if (outside(b, piling)) clear++;
    assert.ok(Number.isFinite(b.x) && Number.isFinite(b.z));
  }
  assert.ok(
    clear > 235,
    `the body spent ${240 - clear} frames inside the piling`,
  );
  // A lateral intent survives the contact: the swim slides around the piling instead of
  // being cancelled by it.
  assert.ok(
    Math.hypot(b.vx, b.vz) > 0.5,
    `swimming against a piling killed all motion (${Math.hypot(b.vx, b.vz).toFixed(2)} m/s)`,
  );
  assert.ok(b.distance > 0.5, "the swim made no progress at all");
});

test("clearing a stump means clearing it by the shell, not by a hair", () => {
  // Contact compares overlapping spans, so the body's own radius counts vertically. A
  // hop that leaves the shell brushing the crown clips it; one that gets the whole shell
  // above the crown carries the body over.
  const stump = rock(0, 1.4, 0.4, 1.0), // crown at y = 1 on flat ground
    trial = (y) => {
      const b = createBody(0, 0.9, y);
      b.vz = 5;
      stepBody(b, { x: 0, z: 1 }, flat([stump]), DT);
      return b;
    };
  const brushing = trial(0.9),
    over = trial(1.25);
  assert.ok(
    brushing.vz <= 0,
    `a body straddling the crown slid through it (${brushing.vz.toFixed(2)} m/s)`,
  );
  const standOff = stump.radius + CONTACT.bodyRadius,
    gap = (b) => Math.hypot(b.x - stump.x, b.z - stump.z);
  assert.ok(
    Math.abs(gap(brushing) - standOff) < 1e-6,
    `and it was not set down at the stand-off radius (${gap(brushing).toFixed(3)})`,
  );
  assert.ok(
    over.vz > 0,
    `a body above the crown was stopped by it (${over.vz.toFixed(2)} m/s)`,
  );
  assert.ok(
    gap(over) < standOff - 1e-3,
    "and it was pushed out as though it had clipped the crown",
  );
});

test("collision response does not depend on render cadence", () => {
  const trunk = rock(0, 4, 0.7, 6);
  const run = (dt) => {
    const b = createBody(-0.4, 0, 0);
    b.vz = 6;
    b.vx = 1.2;
    for (let i = 0; i < Math.round(1.2 / dt); i++)
      stepBody(b, { x: 0, z: 1 }, flat([trunk]), dt);
    return b;
  };
  const a = run(DT),
    c = run(1 / 30);
  assert.ok(
    Math.hypot(a.x - c.x, a.z - c.z) < 1.5,
    "cadence changed where the body ends up",
  );
  assert.ok(
    outside(a, trunk) && outside(c, trunk),
    "a cadence let the body overlap",
  );
});

test("a save written at the rim survives its own validation", async () => {
  // Removing the movement boundary is only safe if the layers that remember where the body
  // has been can hold a position out there. The survey validator runs on write as well as
  // read, so a bound tighter than the ground would quietly stop saving the game.
  const { PlaceMemory, surveyCell, surveyOffset, SURVEY_SPAN, MEMORY_CELL } =
      await import("../src/simulation/place-memory.js"),
    { snapshotCells } = {
      snapshotCells: (m) => Object.keys(m.cells).length,
    };
  const m = new PlaceMemory(1337);
  for (const spot of [
    { x: 0, z: 0 },
    { x: 400, z: -320 },
    { x: -PLAYABLE_BOUND, z: PLAYABLE_BOUND - 0.01 },
  ])
    m.observe(spot, "frontier", 1, {});
  assert.equal(snapshotCells(m), 3, "a distant cell was not remembered at all");
  const restored = PlaceMemory.restore(m.snapshot(), 1337);
  assert.deepEqual(restored.snapshot(), m.snapshot());
  m.noteDrinks({ x: 400, z: -320 }, [{ x: 402, z: -321 }]);
  assert.deepEqual(
    PlaceMemory.restore(m.snapshot(), 1337).drinks,
    m.drinks,
    "a drink track out there was rejected",
  );
  // And the panel's window follows the body: a cell the player is standing in is drawn
  // inside the viewBox at any position in the world, never off the edge of it.
  for (const spot of [
    { x: 0, z: 0 },
    { x: 620, z: -880 },
  ]) {
    const centre = surveyCell(spot.x),
      offset = surveyOffset(centre, centre);
    assert.ok(
      offset === ((SURVEY_SPAN - 1) / 2) * MEMORY_CELL,
      "the cell under the body should sit mid-window",
    );
    const far = surveyOffset(surveyCell(spot.x + 60), centre);
    assert.ok(
      far > 0 && far < SURVEY_SPAN * MEMORY_CELL,
      "a cell 60 m out fell off the map",
    );
  }
});

test("a press and an arrival are distinguishable, and the clock says which", () => {
  const wall = rock(0, 2, 0.8, 6),
    env = flat([wall]),
    b = createBody(0, 0.7, 0);
  b.vz = 6;
  for (let i = 0; i < 20 && !(b.contactTime > 0); i++)
    stepBody(b, { x: 0, z: 1 }, env, DT);
  assert.ok(b.contactTime > 0, "the body never reached the wall");
  const arrivalImpact = b.impact;
  assert.ok(arrivalImpact > 0.05, "an arrival should be felt");
  // Held against it: the contact keeps being resolved, but it stops being news.
  for (let i = 0; i < 30; i++) stepBody(b, { x: 0, z: 1 }, env, DT);
  assert.ok(b.contactTime > 0.4, "sustained contact should keep accumulating");
  assert.ok(
    b.impact < arrivalImpact,
    `a press kept re-thumping (impact ${b.impact.toFixed(2)} vs ${arrivalImpact.toFixed(2)})`,
  );
  b.vz = 0;
  for (let i = 0; i < 60; i++) stepBody(b, { x: 0, z: -1 }, env, DT);
  assert.equal(b.contactTime, 0, "the clock did not reset on separation");
});
