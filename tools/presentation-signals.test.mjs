import test from "node:test";
import assert from "node:assert/strict";
import {
  conspecificMemorySummary,
  ecologySummary,
  observationSnapshot,
  presentationSignals,
  worldTransition,
} from "../src/presentation-signals.js";

const state = () => ({
  frontier: { weather: { rain: 0 } },
  watershed: {
    nodes: [
      {},
      {},
      {
        id: "wetland",
        wetness: 0.2,
        sediment: 0.1,
        contamination: 0.05,
        flow: 0.15,
      },
    ],
  },
  settlement: { response: "watch", legalResponse: "watch" },
  ecosystem: { reeds: 0.4, prey: 0.6, predators: 0.2, labFrogs: 0.05 },
  squirtleEcology: {
    abundance: { freshwater: 0.04, marsh: 0.05, urban: 0.03 },
    suitability: { freshwater: 0.2, marsh: 0.2, urban: 0.2 },
    shuckerPressure: 0,
    shuckerTicks: 0,
  },
  memory: { squirtles: [] },
});

test("weather and watershed state map to bounded presentation signals", () => {
  const s = state(),
    dry = presentationSignals(s);
  s.frontier.weather.rain = 1;
  s.watershed.nodes[2].wetness = 0.8;
  const wet = presentationSignals(s);
  assert.ok(wet.wetGround > dry.wetGround);
  assert.ok(wet.windStrength > dry.windStrength);
  assert.ok(wet.rippleStrength >= dry.rippleStrength);
  for (const key of [
    "rain",
    "wetness",
    "waterQuality",
    "wetGround",
    "windStrength",
  ])
    assert.ok(wet[key] >= 0 && wet[key] <= 1, `${key} must stay normalized`);
});

test("sediment and contamination reduce the water-quality signal", () => {
  const s = state(),
    clean = presentationSignals(s).waterQuality;
  s.watershed.nodes[2].sediment = 0.8;
  s.watershed.nodes[2].contamination = 0.6;
  const fouled = presentationSignals(s).waterQuality;
  assert.ok(fouled < clean);
  assert.ok(presentationSignals(s).waterRoughness > 0.25);
});

test("world transition descriptions report semantic threshold crossings", () => {
  const s = state(),
    before = observationSnapshot(s);
  s.watershed.nodes[2].wetness = 0.72;
  const change = worldTransition(before, observationSnapshot(s));
  assert.equal(change.kind, "wetland");
  assert.match(change.message, /Water|reedbed/i);
});

test("ecology summary remains descriptive rather than objective-driven", () => {
  const summary = ecologySummary(state(), { parched: true, drinkers: [] });
  assert.match(summary, /reeds/);
  assert.match(summary, /grazers/);
  assert.match(summary, /pacing/);
  assert.doesNotMatch(summary, /quest|objective|reward/i);
});


test("same-species ecology and persistent individual memory are legible without becoming objectives", () => {
  const s = state();
  s.squirtleEcology.abundance.marsh = 0.42;
  s.squirtleEcology.suitability.marsh = 0.75;
  s.memory.squirtles.push({
    id: "sq-marsh-reed-shallows-0-abc",
    ecotype: "marsh",
    state: "alive",
  });
  const summary = conspecificMemorySummary(s);
  assert.match(summary, /Squirtle signs/);
  assert.match(summary, /marsh water/);
  assert.match(summary, /remember 1 individual/);
  assert.doesNotMatch(summary, /quest|objective|reward/i);
});

test("world transitions surface only real Shucker, legal and remembered-Squirtle changes", () => {
  const s = state(),
    quiet = observationSnapshot(s);
  s.squirtleEcology.shuckerPressure = 0.8;
  s.squirtleEcology.shuckerTicks = 60;
  const danger = observationSnapshot(s),
    shucker = worldTransition(quiet, danger);
  assert.equal(shucker.kind, "shucker");
  assert.match(shucker.message, /Shucker pressure/);

  s.squirtleEcology.shuckerPressure = 0;
  s.squirtleEcology.shuckerTicks = 0;
  const safe = observationSnapshot(s),
    cleared = worldTransition(danger, safe);
  assert.equal(cleared.kind, "shucker");
  assert.match(cleared.message, /pressure has passed/);

  const legalBefore = observationSnapshot(s);
  s.settlement.legalResponse = "protect";
  const protectedState = observationSnapshot(s),
    legal = worldTransition(legalBefore, protectedState);
  assert.equal(legal.kind, "legal");
  assert.match(legal.message, /watches the road/);

  const memoryBefore = observationSnapshot(s);
  s.memory.squirtles.push({
    id: "sq-urban-water-house-drain-0-def",
    ecotype: "urban",
    state: "alive",
  });
  const remembered = worldTransition(memoryBefore, observationSnapshot(s));
  assert.equal(remembered.kind, "conspecific-memory");
  assert.match(remembered.message, /familiar enough to remember/);
});


test("presentation signals can update a reusable output record without changing values", () => {
  const source = state(),
    reusable = { sentinel: 1 },
    first = presentationSignals(source, reusable);
  assert.equal(first, reusable);
  const before = { ...reusable };
  source.frontier.weather.rain = 0.75;
  const second = presentationSignals(source, reusable);
  assert.equal(second, reusable);
  assert.notEqual(second.rain, before.rain);
  assert.equal(second.sentinel, 1, "unowned caller fields remain untouched");
});
