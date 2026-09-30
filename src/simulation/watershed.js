// Semantic DAG in upstream order. No render objects, fluid particles or scheduler.
const clamp = (n) => Math.max(0, Math.min(1, n));
export const CHANNEL_STAGES = [
  "dry depression",
  "damp groove",
  "trickle",
  "cut channel",
  "established creek",
];
const topology = [
  {
    id: "spring",
    downstream: ["landslide", "outlet"],
    source: 1,
    capacity: 1,
    slope: 0.3,
    soil: 0.5,
  },
  {
    id: "landslide",
    downstream: ["wetland"],
    source: 0,
    capacity: 1,
    slope: 0.2,
    soil: 0.8,
  },
  {
    id: "wetland",
    downstream: ["outlet"],
    source: 0,
    capacity: 1,
    slope: 0.02,
    soil: 0.3,
  },
  {
    id: "outlet",
    downstream: [],
    source: 0,
    capacity: 1,
    slope: 0.01,
    soil: 0.2,
  },
];
export class Watershed {
  constructor() {
    this.nodes = topology.map((n) => ({
      ...n,
      downstream: [...n.downstream],
      blockage: n.id === "landslide" ? 0.95 : 0,
      flow: 0,
      wetness: 0,
      contamination: 0,
      sediment: 0,
      temperatureClass: "cold",
      salinity: 0,
      seasonalModifier: 1,
      vegetation: 0.3,
      erosion: 0,
      stage: 0,
      active: false,
      restoration: 0,
    }));
  }
  update(dt, { diversion = 0, sourceContamination = 0, sourceScale = 1 } = {}) {
    if (!Number.isFinite(dt) || dt < 0 || dt > 1)
      throw new Error("Watershed requires bounded simulation steps");
    const incoming = new Map(
      this.nodes.map((n) => [n.id, { flow: 0, sediment: 0, contamination: 0 }]),
    );
    for (const n of this.nodes) {
      const upstream = incoming.get(n.id),
        supply = upstream.flow + n.source * n.seasonalModifier * sourceScale;
      n.flow = Math.min(n.capacity * (1 - n.blockage), supply);
      n.active = n.flow > 0.01;
      n.wetness = clamp(
        n.wetness +
          (Math.min(1, n.flow) - n.wetness) * (1 - Math.exp(-dt / 12)),
      );
      n.contamination = supply
        ? (upstream.contamination +
            n.source * sourceContamination * sourceScale) /
          supply
        : 0;
      n.sediment = clamp(
        (supply ? upstream.sediment / supply : 0) + n.blockage * n.flow * 0.2,
      );
      n.erosion = Math.min(
        120,
        n.erosion + n.flow * n.slope * n.soil * (1 - n.vegetation) * dt,
      );
      n.stage = [0, 0.1, 1, 4, 12].reduce(
        (stage, threshold, index) => (n.erosion >= threshold ? index : stage),
        0,
      );
      for (const id of n.downstream) {
        const target = incoming.get(id),
          share =
            n.flow *
            (n.id === "spring"
              ? id === "outlet"
                ? diversion
                : 1 - diversion
              : 1 / n.downstream.length);
        target.flow += share;
        target.sediment += share * n.sediment;
        target.contamination += share * n.contamination;
      }
    }
  }
  // Caller supplies verified nearby physical interaction, not a quest completion flag.
  clearDebris(id, effort) {
    if (id !== "landslide" || !Number.isFinite(effort) || effort <= 0)
      return false;
    const node = this.nodes.find((n) => n.id === id);
    node.blockage = clamp(node.blockage - Math.min(effort, 0.1));
    node.restoration = 1 - node.blockage / 0.95;
    return true;
  }
  snapshot() {
    return structuredClone(this.nodes);
  }
  static restore(data, legacy = false) {
    const result = new Watershed();
    if (!Array.isArray(data) || data.length !== result.nodes.length)
      throw new Error("Invalid watershed topology");
    const unit = [
      "blockage",
      "wetness",
      "contamination",
      "sediment",
      "salinity",
      "vegetation",
      "restoration",
    ];
    data.forEach((n, i) => {
      const expected = result.nodes[i];
      for (const key of [
        "id",
        "source",
        "capacity",
        "slope",
        "soil",
        "temperatureClass",
      ])
        if (n[key] !== expected[key])
          throw new Error("Unsupported watershed topology");
      if (
        !(
          legacy &&
          i === 0 &&
          JSON.stringify(n.downstream) === '["landslide"]'
        ) &&
        JSON.stringify(n.downstream) !== JSON.stringify(expected.downstream)
      )
        throw new Error("Invalid downstream links");
      for (const key of [...unit, "flow", "seasonalModifier", "erosion"])
        if (
          !Number.isFinite(n[key]) ||
          n[key] < 0 ||
          n[key] >
            (key === "erosion" ? 120 : key === "seasonalModifier" ? 2 : 1)
        )
          throw new Error("Invalid water scalar");
      if (
        !Number.isInteger(n.stage) ||
        n.stage < 0 ||
        n.stage > 4 ||
        typeof n.active !== "boolean"
      )
        throw new Error("Invalid channel state");
      // Allowlist excludes arbitrary saved properties.
      for (const key of [
        ...unit,
        "flow",
        "seasonalModifier",
        "erosion",
        "stage",
        "active",
      ])
        expected[key] = n[key];
    });
    return result;
  }
}
