import test from "node:test";
import assert from "node:assert/strict";
import {
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
  settlement: { response: "watch" },
  ecosystem: { reeds: 0.4, prey: 0.6, predators: 0.2, labFrogs: 0.05 },
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
