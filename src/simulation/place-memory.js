import { hash2i, clamp } from "../rng.js";
export const LANDMARKS = [
  { id: "bank", name: "The first bank", x: -10, z: 18 },
  { id: "debris", name: "The broken tributary", x: -6, z: 12 },
  { id: "bypass", name: "An old drainage groove", x: -10, z: 10 },
  { id: "lab", name: "The Listening Basin", x: -11, z: 5 },
  { id: "settlement", name: "Reedside water house", x: -15, z: -12 },
  { id: "wetland", name: "The reed shallows", x: -6, z: -15 },
];
export class PlaceMemory {
  constructor(seed = 1337) {
    this.seed = seed;
    this.cells = {};
    this.places = [];
    this.notable = null;
    this.lastEncounter = -1000;
  }
  // Called only for present player observations. Never from offline simulation.
  observe(body, place, tick, ecosystem) {
    if (place === "frontier") {
      const key = `${Math.floor(body.x / 5)},${Math.floor(body.z / 5)}`;
      if (!this.cells[key] && Object.keys(this.cells).length < 841)
        this.cells[key] = 1;
      else if (this.cells[key])
        this.cells[key] = Math.min(255, this.cells[key] + 1);
      for (const m of LANDMARKS)
        if (
          Math.hypot(body.x - m.x, body.z - m.z) < 5 &&
          !this.places.includes(m.id)
        )
          this.places.push(m.id);
    }
    if (
      place === "lab" &&
      ecosystem.labFrogs > 0.12 &&
      Math.hypot(body.x, body.z) < 5 &&
      tick - this.lastEncounter >= 60
    ) {
      this.lastEncounter = tick;
      this.notable ??= {
        id: `reed-frog-${this.seed}`,
        species: "reed frog",
        marking: Math.floor(hash2i(1, 3, this.seed) * 4),
        encounters: 0,
        familiarity: 0,
        fear: 0,
        lastSeen: tick,
      };
      const n = this.notable;
      n.encounters = Math.min(10000, n.encounters + 1);
      n.lastSeen = tick;
      n.fear = clamp(n.fear + (body.jetTime > 0 ? 0.2 : -0.08), 0, 1);
      n.familiarity = clamp(
        n.familiarity + (Math.hypot(body.vx, body.vz) < 1 ? 0.08 : 0.01),
        0,
        1,
      );
    }
  }
  snapshot() {
    return {
      cells: { ...this.cells },
      places: [...this.places],
      notable: this.notable ? { ...this.notable } : null,
      lastEncounter: this.lastEncounter,
    };
  }
  static restore(s, seed) {
    if (
      !s ||
      !s.cells ||
      typeof s.cells !== "object" ||
      Array.isArray(s.cells) ||
      Object.keys(s.cells).length > 841 ||
      !Array.isArray(s.places) ||
      s.places.length > 6
    )
      throw new Error("Invalid map memory");
    const r = new PlaceMemory(seed);
    for (const [k, v] of Object.entries(s.cells)) {
      if (
        !/^-?\d{1,2},-?\d{1,2}$/.test(k) ||
        k.split(",").some((n) => Number(n) < -14 || Number(n) > 14) ||
        !Number.isInteger(v) ||
        v < 1 ||
        v > 255
      )
        throw new Error("Invalid survey cell");
      r.cells[k] = v;
    }
    if (
      new Set(s.places).size !== s.places.length ||
      s.places.some((p) => !LANDMARKS.some((l) => l.id === p))
    )
      throw new Error("Invalid landmarks");
    r.places = [...s.places];
    if (!Number.isSafeInteger(s.lastEncounter) || s.lastEncounter < -1000)
      throw new Error("Invalid encounter time");
    r.lastEncounter = s.lastEncounter;
    if (s.notable) {
      const n = s.notable;
      if (
        n.id !== `reed-frog-${seed}` ||
        n.species !== "reed frog" ||
        !Number.isInteger(n.marking) ||
        n.marking < 0 ||
        n.marking > 3 ||
        !Number.isInteger(n.encounters) ||
        n.encounters < 0 ||
        n.encounters > 10000 ||
        !Number.isSafeInteger(n.lastSeen) ||
        n.lastSeen < 0 ||
        ["fear", "familiarity"].some(
          (k) => !Number.isFinite(n[k]) || n[k] < 0 || n[k] > 1,
        )
      )
        throw new Error("Invalid notable creature");
      r.notable = Object.fromEntries(
        [
          "id",
          "species",
          "marking",
          "encounters",
          "familiarity",
          "fear",
          "lastSeen",
        ].map((k) => [k, n[k]]),
      );
    }
    return r;
  }
}
