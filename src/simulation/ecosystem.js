// Aggregate populations, never a distant collection of scene actors.
const approach = (value, target, seconds) =>
  value + (target - value) * (1 - Math.exp(-1 / seconds));
const defaults = () => ({
  reeds: 0.08,
  insects: 0.06,
  prey: 0.12,
  predators: 0.04,
  cistern: 0.18,
  labWater: 0.12,
  labReeds: 0,
  labInsects: 0,
  labFrogs: 0,
  eligibleSeconds: 0,
});
export class Ecosystem {
  constructor(seed = 1337) {
    this.seed = seed;
    Object.assign(this, defaults());
  }
  tick(watershed) {
    const wetland = watershed.nodes[2],
      outlet = watershed.nodes[3];
    const quality = (1 - wetland.contamination) * (1 - wetland.sediment * 0.5);
    this.reeds = approach(this.reeds, wetland.wetness * quality, 90);
    this.insects = approach(this.insects, this.reeds * quality, 45);
    this.prey = approach(
      this.prey,
      Math.max(0, this.insects * (1 - this.predators * 0.35)),
      80,
    );
    this.predators = approach(this.predators, this.prey * 0.55, 180);
    // Explicit allocation of outlet supply: 20% settlement, 15% basin, 65% onward.
    // Cistern is a normalized stored volume. Basin water is a normalized renewal
    // index (allocated flow / design flow .15), not a second stored volume.
    this.cistern = Math.max(
      0,
      Math.min(1, this.cistern + (outlet.flow * 0.2 - 0.055) / 45),
    );
    this.labWater = approach(
      this.labWater,
      ((outlet.flow * 0.15) / 0.15) * quality,
      60,
    );
    this.labReeds = approach(this.labReeds, this.labWater * this.reeds, 120);
    this.labInsects = approach(this.labInsects, this.labReeds, 60);
    const eligible =
      this.labWater > 0.5 &&
      this.labReeds > 0.35 &&
      this.labInsects > 0.25 &&
      this.prey > 0.2;
    this.eligibleSeconds = eligible
      ? Math.min(3600, this.eligibleSeconds + 1)
      : 0;
    const arrival = 120 + (this.seed % 61);
    this.labFrogs = approach(
      this.labFrogs,
      this.eligibleSeconds >= arrival ? this.prey : 0,
      120,
    );
  }
  snapshot() {
    return Object.fromEntries(
      Object.keys(defaults()).map((key) => [key, this[key]]),
    );
  }
  static restore(data, seed) {
    const result = new Ecosystem(seed);
    for (const key of Object.keys(defaults())) {
      const n = data?.[key];
      if (
        !Number.isFinite(n) ||
        n < 0 ||
        n > (key === "eligibleSeconds" ? 3600 : 1)
      )
        throw new Error("Invalid ecosystem state");
      if (key === "eligibleSeconds" && !Number.isInteger(n))
        throw new Error("Invalid colonization clock");
      result[key] = n;
    }
    return result;
  }
}
