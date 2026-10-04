import { clamp, hash2i } from "../rng.js";

export const ECOTYPES = Object.freeze({
  freshwater: Object.freeze({
    id: "freshwater",
    rarity: 0.32,
    avoidance: 4.8,
    speed: 1.45,
    toughness: 0.25,
    cleanWaterAffinity: 1,
    degradedWaterSensitivity: 1,
    description: "rare clean-water tributary conspecific",
  }),
  saltwater: Object.freeze({
    id: "saltwater",
    rarity: 0.72,
    avoidance: 1.8,
    speed: 1.8,
    toughness: 1,
    strongCurrentAffinity: 1,
    openWaterAffinity: 1,
    description: "tough strong-current coastal conspecific",
  }),
  marsh: Object.freeze({
    id: "marsh",
    rarity: 0.78,
    avoidance: 3.2,
    speed: 1.15,
    toughness: 0.55,
    concealmentBias: 1,
    description: "reed-and-mud concealment conspecific",
  }),
  deepwater: Object.freeze({
    id: "deepwater",
    rarity: 0.5,
    avoidance: 2.8,
    speed: 1.65,
    toughness: 0.72,
    deepWaterAffinity: 1,
    surfaceAverse: true,
    description: "surface-averse deep flooded-habitat conspecific",
  }),
  urban: Object.freeze({
    id: "urban",
    rarity: 0.58,
    avoidance: 1.7,
    speed: 1.25,
    toughness: 0.62,
    humanTolerance: 0.78,
    infrastructureAffinity: 1,
    description: "drainage and settlement-edge conspecific",
  }),
});

export const ECOTYPE_IDS = Object.freeze(Object.keys(ECOTYPES));

export const HABITATS = Object.freeze([
  Object.freeze({
    id: "reed-shallows",
    ecotype: "marsh",
    x: -6,
    z: -15,
    capacity: 2,
    radius: 7,
    spawnThreshold: 0.18,
  }),
  Object.freeze({
    id: "water-house-drain",
    ecotype: "urban",
    x: -13,
    z: -10,
    capacity: 2,
    radius: 6,
    spawnThreshold: 0.16,
  }),
  Object.freeze({
    id: "spring-gully",
    ecotype: "freshwater",
    x: 34,
    z: 14,
    capacity: 1,
    radius: 6,
    spawnThreshold: 0.22,
  }),
]);

const emptyMap = () => ({
  freshwater: 0,
  saltwater: 0,
  marsh: 0,
  deepwater: 0,
  urban: 0,
});
const quality = (node) =>
  clamp((1 - (node?.contamination ?? 0)) * (1 - (node?.sediment ?? 0) * 0.5), 0, 1);
const approach = (value, target, seconds) =>
  value + (target - value) * (1 - Math.exp(-1 / seconds));
const legalPressure = Object.freeze({
  ignore: 0.02,
  watch: 0.08,
  tolerate: 0.05,
  feed: 0.03,
  report: 0.46,
  protect: 0.015,
});

export class ConspecificEcology {
  constructor(seed = 1337) {
    this.seed = seed;
    this.tickCount = 0;
    this.suitability = emptyMap();
    this.abundance = emptyMap();
    this.abundance.freshwater = 0.03;
    this.abundance.marsh = 0.06;
    this.abundance.urban = 0.05;
    this.humanPressure = 0.06;
    this.shuckerPressure = 0;
    this.shuckerTicks = 0;
    this.revision = 0;
    this.signature = "";
  }

  induceShuckerPressure(amount = 0.75, seconds = 90) {
    if (!Number.isFinite(amount) || !Number.isFinite(seconds) || seconds <= 0)
      return false;
    this.shuckerPressure = clamp(Math.max(this.shuckerPressure, amount), 0, 1);
    this.shuckerTicks = Math.max(this.shuckerTicks, Math.min(600, Math.floor(seconds)));
    this.bumpRevision();
    return true;
  }

  report(amount = 0.18) {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    this.humanPressure = clamp(this.humanPressure + amount, 0, 1);
    this.bumpRevision();
    return true;
  }

  bumpRevision() {
    this.revision = (this.revision + 1) >>> 0;
  }

  tick(watershed, ecosystem, settlement) {
    this.tickCount++;
    if (this.shuckerTicks > 0) {
      this.shuckerTicks--;
      if (this.shuckerTicks === 0) this.shuckerPressure *= 0.35;
      else this.shuckerPressure = Math.max(0, this.shuckerPressure - 0.0015);
    } else {
      this.shuckerPressure = Math.max(0, this.shuckerPressure - 0.0025);
      if (this.tickCount % 180 === 0) {
        const bucket = Math.floor(this.tickCount / 180);
        if (hash2i(bucket, 771, this.seed) < 0.018) {
          this.shuckerPressure = 0.68 + hash2i(bucket, 772, this.seed) * 0.22;
          this.shuckerTicks = 75 + Math.floor(hash2i(bucket, 773, this.seed) * 90);
        }
      }
    }

    const response = settlement?.legalResponse ?? "watch";
    this.humanPressure = approach(
      this.humanPressure,
      legalPressure[response] ?? legalPressure.watch,
      120,
    );

    const spring = watershed?.nodes?.[0],
      landslide = watershed?.nodes?.[1],
      wetland = watershed?.nodes?.[2];
    const safety = clamp(1 - this.humanPressure * 0.42 - this.shuckerPressure * 0.78, 0, 1);
    const springQuality = quality(spring),
      wetlandQuality = quality(wetland),
      restoration = clamp(landslide?.restoration ?? 0, 0, 1);
    this.suitability.freshwater = clamp(
      (0.28 + restoration * 0.72) *
        springQuality *
        clamp((spring?.wetness ?? 0) * 0.6 + (spring?.flow ?? 0) * 0.4, 0, 1) *
        safety,
      0,
      1,
    );
    this.suitability.marsh = clamp(
      ((wetland?.wetness ?? 0) * 0.58 + (ecosystem?.reeds ?? 0) * 0.42) *
        wetlandQuality *
        safety,
      0,
      1,
    );
    const caretakerBoost = response === "protect" ? 1 : response === "feed" ? 0.9 : 0.78;
    this.suitability.urban = clamp(
      ((ecosystem?.cistern ?? 0) * 0.55 + (settlement?.waterReliability ?? 0) * 0.45) *
        caretakerBoost *
        (1 - this.humanPressure * 0.28) *
        (1 - this.shuckerPressure * 0.65),
      0,
      1,
    );
    this.suitability.saltwater = 0;
    this.suitability.deepwater = 0;

    for (const id of ECOTYPE_IDS) {
      const target = this.suitability[id] * ECOTYPES[id].rarity;
      this.abundance[id] = approach(this.abundance[id], target, id === "freshwater" ? 240 : 150);
    }

    const signature = [
      ...ECOTYPE_IDS.map((id) => Math.round(this.suitability[id] * 20)),
      Math.round(this.humanPressure * 20),
      Math.round(this.shuckerPressure * 20),
      response,
    ].join("|");
    if (signature !== this.signature) {
      this.signature = signature;
      this.bumpRevision();
    }
  }

  habitatSuitability(habitat) {
    const h = typeof habitat === "string"
      ? HABITATS.find((candidate) => candidate.id === habitat)
      : habitat;
    return h ? this.suitability[h.ecotype] ?? 0 : 0;
  }

  habitatEligible(habitat) {
    const h = typeof habitat === "string"
      ? HABITATS.find((candidate) => candidate.id === habitat)
      : habitat;
    if (!h) return false;
    if (h.ecotype === "saltwater" || h.ecotype === "deepwater") return false;
    return this.habitatSuitability(h) >= h.spawnThreshold;
  }

  shuckerEvidence() {
    if (this.shuckerPressure < 0.35 || this.shuckerTicks <= 0) return null;
    const bucket = Math.floor(this.tickCount / 30),
      base = HABITATS[hash2i(bucket, 880, this.seed) < 0.5 ? 0 : 1],
      angle = hash2i(bucket, 881, this.seed) * Math.PI * 2,
      radius = 1.5 + hash2i(bucket, 882, this.seed) * 2.5;
    return {
      id: `shucker-${bucket}`,
      type: "shucker",
      x: base.x + Math.sin(angle) * radius,
      z: base.z + Math.cos(angle) * radius,
      strength: this.shuckerPressure,
    };
  }

  snapshot() {
    return {
      tickCount: this.tickCount,
      suitability: { ...this.suitability },
      abundance: { ...this.abundance },
      humanPressure: this.humanPressure,
      shuckerPressure: this.shuckerPressure,
      shuckerTicks: this.shuckerTicks,
    };
  }

  static restore(data, seed = 1337) {
    if (!data || !Number.isSafeInteger(data.tickCount) || data.tickCount < 0)
      throw new Error("Invalid conspecific ecology clock");
    const restored = new ConspecificEcology(seed);
    for (const group of ["suitability", "abundance"]) {
      if (!data[group] || typeof data[group] !== "object" || Array.isArray(data[group]))
        throw new Error("Invalid conspecific ecology map");
      for (const id of ECOTYPE_IDS) {
        const value = data[group][id];
        if (!Number.isFinite(value) || value < 0 || value > 1)
          throw new Error("Invalid conspecific ecology scalar");
        restored[group][id] = value;
      }
    }
    for (const key of ["humanPressure", "shuckerPressure"]) {
      if (!Number.isFinite(data[key]) || data[key] < 0 || data[key] > 1)
        throw new Error("Invalid conspecific pressure");
      restored[key] = data[key];
    }
    if (!Number.isInteger(data.shuckerTicks) || data.shuckerTicks < 0 || data.shuckerTicks > 600)
      throw new Error("Invalid Shucker duration");
    restored.tickCount = data.tickCount;
    restored.shuckerTicks = data.shuckerTicks;
    restored.signature = "";
    restored.revision = 1;
    return restored;
  }
}