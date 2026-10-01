import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  RECORD_DEPTH,
  RECORD_MATERIALS,
  deepHistory,
  deepTimeLedger,
  layerThickness,
  recordRows,
} from "../src/simulation/deep-history.js";
import { DeepRecord, recordRegion } from "../src/player/deep-record.js";

const eras = deepHistory(1337);
const history = [
  { tick: 14500, flow: 0.4, reeds: 0.62, fire: 0 },
  { tick: 14800, flow: 0.41, reeds: 0.58, fire: 0 },
  { tick: 41200, flow: 0.42, reeds: 0.5, fire: 0.01 },
];
const nodes = [
  { id: "spring", erosion: 1024.62, sediment: 0.1 },
  { id: "landslide", erosion: 20.3, sediment: 0.4 },
  { id: "wetland", erosion: 5.05, sediment: 0.312 },
  { id: "outlet", erosion: 1.0, sediment: 0.9 },
];
const sample = (over = {}) =>
  deepTimeLedger({
    eras,
    y: -12.4,
    tick: 41208,
    history,
    nodes,
    stage: 4,
    diversion: 0.45,
    ...over,
  });

test("the shaft's floor is one number, agreed by the walls, the floor and the readout", () => {
  assert.equal(recordRegion.sample().height, -RECORD_DEPTH);
  const scene = new THREE.Scene();
  const record = new DeepRecord(scene, 1337);
  assert.equal(record.floor.position.y, -RECORD_DEPTH);
  assert.equal(record.group.children.length, eras.length + 1);
  assert.equal(RECORD_DEPTH, 22);
  record.dispose();
  assert.equal(scene.children.length, 0);
});

test("the layers tile the shaft without gaps or overlaps", () => {
  let total = 0;
  for (let i = 0; i < eras.length; i++) {
    const t = layerThickness(eras, i);
    assert.ok(t > 0, "every layer has thickness");
    // The seeded depths carry float noise (1.5 + 3 * 2.3 is not exactly 8.4), so the
    // contiguity of the stack is asserted within a micrometre, not to the last bit.
    if (eras[i + 1])
      assert.ok(
        Math.abs(eras[i].depth + t - eras[i + 1].depth) < 1e-6,
        `layer ${i} does not meet the next one`,
      );
    total += t;
  }
  // From the first layer down to the floor the stack is complete; the 1.5 m of bank
  // above it is not a layer, and the test says so rather than fudging the sum.
  assert.equal(+total.toFixed(6), +(RECORD_DEPTH - eras[0].depth).toFixed(6));
  assert.equal(
    +eras[eras.length - 1].depth.toFixed(6) + layerThickness(eras, 7),
    RECORD_DEPTH,
  );
  assert.equal(layerThickness(eras, 99), 0);
});

test("the ledger measures the state it is handed, exactly", () => {
  const l = sample();
  assert.equal(l.depth, 12.4);
  assert.equal(l.floor, RECORD_DEPTH);
  // −12.4 m sits nearest the layer at depth 13.1, i.e. the sixth of eight.
  assert.equal(l.layer, 5);
  assert.equal(l.layers, 8);
  assert.equal(l.thickness, 2.3);
  assert.equal(l.material, RECORD_MATERIALS[eras[5].material]);
  assert.equal(l.yearsAgo, eras[5].yearsAgo);
  assert.equal(l.ticks, 41208);
  assert.deepEqual(l.ledger, { entries: 3, span: 26700 });
  assert.equal(l.wear, +(1024.62 + 20.3 + 5.05 + 1.0).toFixed(1));
  assert.equal(l.sediment, 0.31);
  assert.equal(l.cutMetres, 0.22);
  assert.equal(l.cutShare, +((0.22 * 100) / 22).toFixed(1));
  assert.deepEqual(l.trend, { flow: 0.02, reeds: -0.12, fire: 0.01 });
});

test("the cut you can make is a measurable fraction of the depth below you", () => {
  const shares = [0, 1, 2, 3, 4].map((stage) => sample({ stage }).cutShare);
  assert.deepEqual(
    shares,
    [0, 0.025, 0.07, 0.14, 0.22].map((m) => +((m * 100) / 22).toFixed(1)),
  );
  assert.ok(
    shares[4] < 1.01,
    "the deepest cut is still about one percent of the shaft",
  );
  for (let i = 1; i < shares.length; i++) assert.ok(shares[i] > shares[i - 1]);
});

test("an empty ledger and a bare graph produce no phantom numbers", () => {
  const l = deepTimeLedger({
    eras,
    y: -1,
    tick: 0,
    history: [],
    nodes: [],
    stage: 0,
  });
  assert.equal(l.ledger, null);
  assert.equal(l.trend, null);
  assert.equal(l.wear, 0);
  assert.equal(l.sediment, 0);
  for (const value of Object.values(l))
    if (typeof value === "number") assert.ok(Number.isFinite(value));
  const rows = recordRows(l);
  assert.ok(rows.some((r) => /ledger empty/.test(r.value)));
  assert.ok(rows.some((r) => /no second entry yet/.test(r.value)));
});

test("measuring never touches the world it measures, and repeats identically", () => {
  const live = {
    eras,
    y: -12.4,
    tick: 41208,
    history,
    nodes,
    stage: 4,
    diversion: 0.45,
  };
  const before = JSON.stringify({ eras, history, nodes });
  const a = deepTimeLedger(live);
  const b = deepTimeLedger(live);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify({ eras, history, nodes }), before);
  assert.deepEqual(recordRows(a), recordRows(b));
});

test("no number reaches the readout that was not measured in the ledger", () => {
  for (const ledger of [
    sample(),
    sample({ stage: 0, diversion: 0 }),
    deepTimeLedger({
      eras,
      y: -20.9,
      tick: 7,
      history: [],
      nodes: [],
      stage: 2,
    }),
    // A depth that needs rounding to be displayed: the ledger has to do the rounding, or
    // the screen shows a number the measurement never held.
    sample({ y: -12.367, stage: 3, diversion: 0.45 }),
    sample({ y: -1.21 }),
  ]) {
    const allowed = new Set();
    for (const value of Object.values(ledger)) {
      if (typeof value === "number") allowed.add(Math.abs(value));
      else if (value && typeof value === "object")
        for (const inner of Object.values(value))
          if (typeof inner === "number") allowed.add(Math.abs(inner));
    }
    // 1-based counting is presentation, as is the shaft floor repeated in prose; anything
    // else on screen has to be a number the measurement produced.
    allowed.add(ledger.layer + 1);
    allowed.add(ledger.floor);
    for (const row of recordRows(ledger))
      for (const token of row.value.match(/[\d][\d.,]*/g) ?? []) {
        const n = parseFloat(token.replace(/,/g, ""));
        const presentation = n === ledger.layer + 1 || n === ledger.layers;
        assert.ok(
          allowed.has(n) || presentation,
          `readout invented "${token}" in "${row.label}: ${row.value}"`,
        );
      }
  }
});

test("the two clocks are never mixed in one sentence", () => {
  for (const ledger of [sample(), sample({ stage: 0, diversion: 0 })]) {
    const rows = recordRows(ledger);
    const dated = rows.filter((r) => /years/.test(r.value));
    assert.deepEqual(
      dated.map((r) => r.label).sort(),
      ["recorded", "the shaft does not convert"],
      "only the record's own date, and the sentence about the clocks, may speak of years",
    );
    for (const row of rows)
      if (!/does not convert/.test(row.label))
        assert.ok(
          !/years.*ticks|ticks.*years/.test(row.value),
          `one row mixed the two clocks: ${row.value}`,
        );
    const limit = rows.find((r) => /does not convert/.test(r.label));
    assert.ok(limit && /ticks/.test(limit.value));
  }
});

test("an implication appears only when the measured state supports it", () => {
  const diverted = recordRows(sample()).find(
    (r) => r.label === "while you were here",
  );
  assert.ok(diverted && /reeds fell/.test(diverted.value));
  const untouched = recordRows(sample({ stage: 0, diversion: 0 })).find(
    (r) => r.label === "while you were here",
  );
  assert.ok(untouched && /still recorded/.test(untouched.value));
  // Reeds rising while diverted is no implication at all: the row must simply not exist.
  const rising = recordRows(
    deepTimeLedger({
      eras,
      y: -12.4,
      tick: 41208,
      history: [
        { tick: 14500, flow: 0.4, reeds: 0.5, fire: 0 },
        { tick: 41200, flow: 0.42, reeds: 0.66, fire: 0 },
      ],
      nodes,
      stage: 4,
      diversion: 0.45,
    }),
  ).find((r) => r.label === "while you were here");
  assert.equal(rising, undefined);
});

test("the shaft's mouth is measured, not described", () => {
  // Standing at or above the water in the shaft must never read as a negative depth, and
  // must never claim a stratum: the first band starts 1.5 m down and the bank is not record.
  const atMouth = recordRows(sample({ y: 0 }));
  assert.equal(atMouth[0].value, "0.0 m of 22");
  assert.equal(
    atMouth[1].value,
    "bank over record · 1.5 m above the first band",
  );
  assert.match(atMouth[2].value, /bank has no date/);
  assert.ok(
    !atMouth.some((r) => /−0\.0/.test(r.value)),
    "a negative zero on an instrument is a lie about direction",
  );
  const inBank = recordRows(sample({ y: -1.4 }))[1];
  assert.equal(inBank.value, "bank over record · 0.1 m above the first band");
  // One tenth of a metre lower and you are in the first band of record proper.
  const inRecord = recordRows(sample({ y: -1.5 }))[1];
  assert.match(inRecord.value, /^1 of 8 · /);
});

test("the caption the record already had is preserved", () => {
  const scene = new THREE.Scene();
  const record = new DeepRecord(scene, 1337);
  const at = record.describe(-1.5);
  assert.match(at, /^About \d+ years ago\. /);
  assert.equal(at.includes(`${record.eras[0].yearsAgo}`), true);
  assert.ok(record.eras[0].event.length > 20);
  record.dispose();
});
