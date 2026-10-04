import { hash2i, clamp } from "../rng.js";
import { RECORD_BANDS } from "./deep-history.js";
import { REACHES, reachAt } from "./reaches.js";
import { ECOTYPE_IDS, HABITATS } from "./squirtle-ecology.js";
export const MAX_NOTABLE_CONSPECIFICS = 4;
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
    this.squirtles = [];
    this.lastEncounter = -1000;
    this.drinks = {};
    this.reaches = [];
    // Bands of the Deep Record the player has stood inside long enough to read.
    // Indices, not flags: eight booleans would be a wider save contract than the fact.
    this.strata = [];
  }
  // Learning a band is the only write, and it is idempotent: hovering the same stratum
  // for a minute is one reading, not sixty.
  markStrata(index, count = RECORD_BANDS) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= count ||
      this.strata.includes(index)
    )
      return false;
    this.strata.push(index);
    this.strata.sort((a, b) => a - b);
    return true;
  }
  findNotableConspecific(id) {
    return this.squirtles.find((record) => record.id === id) ?? null;
  }
  rememberConspecific(actor, tick) {
    if (!actor?.id || !ECOTYPE_IDS.includes(actor.ecotype)) return null;
    if (!HABITATS.some((habitat) => habitat.id === actor.habitatId)) return null;
    let record = this.findNotableConspecific(actor.id);
    if (!record) {
      if (this.squirtles.length >= MAX_NOTABLE_CONSPECIFICS) return null;
      record = {
        id: actor.id,
        ecotype: actor.ecotype,
        marking: actor.marking,
        encounters: 0,
        familiarity: 0,
        fear: 0,
        trust: 0,
        lastSeen: tick,
        home: actor.habitatId,
        state: "alive",
      };
      this.squirtles.push(record);
    }
    record.encounters = Math.min(10000, Math.max(record.encounters, actor.encounters || 0));
    record.familiarity = clamp(actor.familiarity ?? record.familiarity, 0, 1);
    record.fear = clamp(actor.fear ?? record.fear, 0, 1);
    record.trust = clamp(actor.trust ?? record.trust, 0, 1);
    record.lastSeen = tick;
    record.state = "alive";
    return record;
  }
  // Where the herd was seen drinking, as observed from here. Behavior, not
  // population: it never changes how many animals exist.
  noteDrinks(body, drinkers) {
    if (!drinkers?.length) return;
    for (const site of drinkers) {
      if (Math.hypot(site.x - body.x, site.z - body.z) > 10) continue;
      const key = `${Math.floor(site.x / 5)},${Math.floor(site.z / 5)}`;
      if (!(key in this.drinks) && Object.keys(this.drinks).length >= 200)
        return;
      this.drinks[key] = Math.min(255, (this.drinks[key] ?? 0) + 1);
    }
  }
  // Called only for present player observations. Never from offline simulation.
  observe(body, place, tick, ecosystem) {
    if (place === "frontier") {
      const key = `${Math.floor(body.x / 5)},${Math.floor(body.z / 5)}`;
      if (!this.cells[key] && Object.keys(this.cells).length < 841)
        this.cells[key] = 1;
      else if (this.cells[key])
        this.cells[key] = Math.min(255, this.cells[key] + 1);
      const reach = reachAt(body.x, body.z);
      if (
        reach &&
        !this.reaches.includes(reach.id) &&
        this.reaches.length < REACHES.length
      )
        this.reaches.push(reach.id);
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
      drinks: { ...this.drinks },
      reaches: [...this.reaches],
      strata: [...this.strata],
      places: [...this.places],
      squirtles: this.squirtles.map((record) => ({ ...record })),
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
    if (s.reaches !== undefined) {
      if (
        !Array.isArray(s.reaches) ||
        s.reaches.length > REACHES.length ||
        new Set(s.reaches).size !== s.reaches.length ||
        s.reaches.some((id) => !REACHES.some((r) => r.id === id))
      )
        throw new Error("Invalid followed reaches");
      r.reaches = [...s.reaches];
    }
    if (s.strata !== undefined) {
      if (
        !Array.isArray(s.strata) ||
        s.strata.length > RECORD_BANDS ||
        new Set(s.strata).size !== s.strata.length ||
        s.strata.some(
          (n) => !Number.isInteger(n) || n < 0 || n > RECORD_BANDS - 1,
        )
      )
        throw new Error("Invalid read strata");
      r.strata = [...s.strata];
    }
    if (
      new Set(s.places).size !== s.places.length ||
      s.places.some((p) => !LANDMARKS.some((l) => l.id === p))
    )
      throw new Error("Invalid landmarks");
    r.places = [...s.places];
    if (s.drinks !== undefined) {
      if (!s.drinks || typeof s.drinks !== "object" || Array.isArray(s.drinks))
        throw new Error("Invalid drink tracks");
      const keys = Object.keys(s.drinks);
      if (keys.length > 200) throw new Error("Too many drink tracks");
      for (const [k, v] of keys.map((key) => [key, s.drinks[key]])) {
        if (
          !/^-?\d{1,2},-?\d{1,2}$/.test(k) ||
          k.split(",").some((n) => Number(n) < -14 || Number(n) > 14) ||
          !Number.isInteger(v) ||
          v < 1 ||
          v > 255
        )
          throw new Error("Invalid drink track");
        r.drinks[k] = v;
      }
    }
    if (s.squirtles !== undefined) {
      if (
        !Array.isArray(s.squirtles) ||
        s.squirtles.length > MAX_NOTABLE_CONSPECIFICS ||
        new Set(s.squirtles.map((record) => record.id)).size !== s.squirtles.length
      )
        throw new Error("Invalid notable conspecifics");
      for (const record of s.squirtles) {
        if (
          typeof record.id !== "string" ||
          !/^sq-[a-z0-9-]{5,96}$/.test(record.id) ||
          !ECOTYPE_IDS.includes(record.ecotype) ||
          !Number.isInteger(record.marking) ||
          record.marking < 0 ||
          record.marking > 4095 ||
          !Number.isInteger(record.encounters) ||
          record.encounters < 0 ||
          record.encounters > 10000 ||
          !Number.isSafeInteger(record.lastSeen) ||
          record.lastSeen < 0 ||
          !HABITATS.some((habitat) => habitat.id === record.home) ||
          !["alive", "unknown"].includes(record.state) ||
          ["familiarity", "fear", "trust"].some(
            (key) => !Number.isFinite(record[key]) || record[key] < 0 || record[key] > 1,
          )
        )
          throw new Error("Invalid notable conspecific");
        r.squirtles.push({ ...record });
      }
    }
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
