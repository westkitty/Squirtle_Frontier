import { hash2i } from "../rng.js";
import { CHANNEL_DEPTH } from "./channel-terrain.js";
// Seeded aggregate eras, inspired by LF's bounded history: never centuries of actors.
export function deepHistory(seed) {
  const events = [
    "A river shifted east, leaving pale silt in a silent channel.",
    "A water house drew from the spring. Cut stone remembers its cistern.",
    "A long dry season lowered the reeds. Wind laid sand over the mud.",
    "Floodwater crossed the old bank. Seeds settled in a new wetland.",
  ];
  return Array.from({ length: 8 }, (_, i) => ({
    id: i,
    depth: 1.5 + i * 2.3,
    yearsAgo: 80 + i * 160 + Math.floor(hash2i(i, 21, seed) * 70),
    event: events[Math.floor(hash2i(i, 4, seed) * events.length)],
    material: Math.floor(hash2i(i, 8, seed) * 4),
  }));
}

// The shaft floor. One constant, because three places need to agree: the cylinder stack,
// the floor disc and every number the readout compares a depth against.
export const RECORD_DEPTH = 22;
// What the four material indices look like down here. Naming is presentation; the index
// itself stays the seeded value.
export const RECORD_MATERIALS = Object.freeze([
  "pale silt",
  "wind-laid sand",
  "dark peat",
  "grey clay",
]);

const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const signed = (n, digits) =>
  `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}`;

// The last layer runs to the floor, so nothing between the first band and the floor is
// unaccounted for. The bank above the first band is not a layer, and says so.
export function layerThickness(eras, index) {
  const era = eras[index];
  if (!era) return 0;
  const next = eras[index + 1];
  return +((next ? next.depth : RECORD_DEPTH) - era.depth).toFixed(6);
}

// Everything the readout is allowed to know, measured from live state. Deliberately no
// conversion between the two clocks this basin keeps: the record is counted in years and
// the simulation is counted in ticks, and nothing in the water translates between them.
export function deepTimeLedger({
  eras = [],
  y = 0,
  tick = 0,
  history = [],
  nodes = [],
  stage = 0,
  diversion = 0,
} = {}) {
  const depth = Math.max(0, -y);
  // The top of the record is not the top of the shaft: the first band starts 1.5 m down
  // and the bank above it is not strata, so the readout says bank rather than inventing a
  // layer for the ground you are standing on.
  const bankAbove = eras.length ? Math.max(0, eras[0].depth - depth) : 0;
  const inBank = eras.length > 0 && depth < eras[0].depth;
  let layer = 0;
  for (let i = 0; i < eras.length; i++)
    if (Math.abs(eras[i].depth - depth) < Math.abs(eras[layer].depth - depth))
      layer = i;
  const era = eras[layer];
  const wear = nodes.reduce((sum, n) => sum + (n.erosion || 0), 0);
  const wetland = nodes.find((n) => n.id === "wetland") ?? null;
  const first = history[0] ?? null;
  const last = history.length > 1 ? history[history.length - 1] : null;
  const cutMetres = CHANNEL_DEPTH[stage] ?? 0;
  const finite = (n) => (Number.isFinite(n) ? n : 0);
  return {
    layers: eras.length,
    layer,
    // Rounded to what the readout can show: a presentation step that re-rounds a number
    // would put a numeral on screen that the measurement never produced.
    depth: +finite(depth).toFixed(1),
    inBank,
    bankAbove: +finite(bankAbove).toFixed(1),
    floor: RECORD_DEPTH,
    thickness: era ? layerThickness(eras, layer) : 0,
    material: era
      ? (RECORD_MATERIALS[era.material] ?? "unsorted sediment")
      : null,
    yearsAgo: era ? era.yearsAgo : null,
    ticks: finite(tick),
    ledger:
      first && last
        ? { entries: history.length, span: finite(last.tick - first.tick) }
        : null,
    wear: +finite(wear).toFixed(1),
    sediment: +finite(wetland?.sediment).toFixed(2),
    diversion: +finite(diversion).toFixed(2),
    stage,
    cutMetres: +finite(cutMetres).toFixed(2),
    cutShare: +((cutMetres * 100) / RECORD_DEPTH).toFixed(1),
    trend: last
      ? {
          flow: +finite(last.flow - first.flow).toFixed(2),
          reeds: +finite(last.reeds - first.reeds).toFixed(2),
          fire: +finite(last.fire - first.fire).toFixed(2),
        }
      : null,
  };
}

// The instrument itself: label and value rows, built from the ledger and nothing else, so
// a test can prove no number reaches the screen that was not measured above.
export function recordRows(ledger) {
  const l = ledger;
  const rows = [
    {
      label: "shaft",
      value: `${l.depth > 0 ? "−" : ""}${l.depth.toFixed(1)} m of ${l.floor}`,
    },
    {
      label: "layer",
      value: l.inBank
        ? `bank over record · ${l.bankAbove} m above the first band`
        : `${l.layer + 1} of ${l.layers} · ${l.thickness.toFixed(1)} m of ${l.material ?? "unsorted sediment"}`,
    },
    {
      label: "recorded",
      value: l.inBank
        ? "the bank has no date; it is what grew on top of the record"
        : l.yearsAgo === null
          ? "no date on this layer"
          : `about ${l.yearsAgo} years ago`,
    },
    {
      label: "basin clock",
      value: `${group(l.ticks)} ticks${
        l.ledger
          ? ` · ledger ${l.ledger.entries} entries over ${group(l.ledger.span)} s`
          : " · ledger empty"
      }`,
    },
    {
      label: "water moved",
      value: `${group(l.wear)} units of wear · ${l.sediment} of sediment in the shallows`,
    },
    {
      label: "your cut",
      value: `${l.cutMetres.toFixed(2)} m of floor · ${l.cutShare.toFixed(1)}% of the ${l.floor} m below you`,
    },
    {
      label: "trend",
      value: l.trend
        ? `flow ${signed(l.trend.flow, 2)} · reeds ${signed(l.trend.reeds, 2)} · fire ${signed(
            l.trend.fire,
            2,
          )}`
        : "no second entry yet",
    },
    {
      label: "the shaft does not convert",
      value:
        "record in years, basin in ticks; nothing in the water translates between them",
    },
  ];
  // Two implications, and only ever stated as correlation: the sim knows the side route
  // takes supply off the wetland, and it knows the spring wears its channel with nobody
  // here. Anything sharper than that would be invention.
  if (l.trend && l.trend.reeds < 0 && l.diversion > 0.1)
    rows.splice(6, 0, {
      label: "while you were here",
      value: `reeds fell ${Math.abs(l.trend.reeds).toFixed(2)} as your side route took ${l.diversion} of the supply`,
    });
  else if (l.stage === 0 && l.wear > 0)
    rows.splice(6, 0, {
      label: "while you were here",
      value: `nothing was cut, and the graph still recorded ${group(l.wear)} units of wear`,
    });
  return rows;
}
