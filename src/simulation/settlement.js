// Small settlement memory, owned by WorldState. No NPC scene nodes or UI flags.
import { clamp } from "../rng.js";
export const WATER_HOUSE = Object.freeze({ x: -15, z: -12 });
export const SETTLEMENT_BOWL = Object.freeze({ x: -12.6, z: -8.9 });
export class Settlement {
  constructor() {
    this.familiarity = 0;
    this.fear = 0;
    this.visits = 0;
    this.lastVisit = -1000;
    this.present = false;
    this.bowl = 0;
    this.waterReliability = 0;
  }
  observe(body, place, tick) {
    const nearby =
      place === "frontier" &&
      Math.hypot(body.x - WATER_HOUSE.x, body.z - WATER_HOUSE.z) < 6;
    if (nearby) {
      if (!this.present && tick - this.lastVisit >= 30) {
        this.visits = Math.min(10000, this.visits + 1);
        this.lastVisit = tick;
      }
      const alarming = body.jetTime > 0 || Math.hypot(body.vx, body.vz) > 5;
      this.fear = clamp(this.fear + (alarming ? 0.12 : -0.008), 0, 1);
      if (!alarming && Math.hypot(body.vx, body.vz) < 1.5)
        this.familiarity = clamp(this.familiarity + 0.005, 0, 1);
    }
    this.present = nearby;
  }
  drinkBowl() {
    if (this.bowl < 0.05) return false;
    const consumed = Math.min(this.bowl, 0.25);
    this.bowl -= consumed;
    this.familiarity = clamp(this.familiarity + 0.06, 0, 1);
    this.fear = Math.max(0, this.fear - 0.1);
    return true;
  }
  tick(ecosystem) {
    this.waterReliability +=
      (ecosystem.cistern - this.waterReliability) * (1 - Math.exp(-1 / 120));
    this.fear = Math.max(0, this.fear - 0.0005);
    // One bowl unit is .002 normalized cistern volume. Refill is real allocation.
    const eligible =
      this.familiarity >= 0.25 && this.fear < 0.3 && ecosystem.cistern > 0.15;
    if (eligible) {
      const refill = Math.min(1 - this.bowl, 0.025, ecosystem.cistern / 0.002);
      this.bowl += refill;
      ecosystem.cistern -= refill * 0.002;
    }
    this.bowl = Math.max(0, this.bowl - 0.00015);
  }
  get response() {
    return this.fear > 0.3
      ? "withdraw"
      : this.waterReliability < 0.2
        ? "check-water"
        : this.familiarity >= 0.25
          ? "welcome"
          : "watch";
  }
  snapshot() {
    return {
      familiarity: this.familiarity,
      fear: this.fear,
      visits: this.visits,
      lastVisit: this.lastVisit,
      present: this.present,
      bowl: this.bowl,
      waterReliability: this.waterReliability,
    };
  }
  static restore(s) {
    if (!s) throw new Error("Missing settlement state");
    const r = new Settlement();
    for (const key of ["familiarity", "fear", "bowl", "waterReliability"]) {
      if (!Number.isFinite(s[key]) || s[key] < 0 || s[key] > 1)
        throw new Error("Invalid settlement scalar");
      r[key] = s[key];
    }
    if (
      !Number.isInteger(s.visits) ||
      s.visits < 0 ||
      s.visits > 10000 ||
      !Number.isSafeInteger(s.lastVisit) ||
      s.lastVisit < -1000 ||
      typeof s.present !== "boolean"
    )
      throw new Error("Invalid settlement memory");
    r.visits = s.visits;
    r.lastVisit = s.lastVisit;
    r.present = s.present;
    return r;
  }
}
// Conservative proxies shared by contact and camera; they never depend on mesh names.
export const settlementObstacles = [
  { x: -15, z: -12, radius: 1.9, height: 3.9 },
  { x: -12.6, z: -12, radius: 1.05, height: 1 },
];

export function settlementDialogue(settlement, body) {
  if (!settlement) return null;
  const d = Math.hypot(body.x - WATER_HOUSE.x, body.z - WATER_HOUSE.z);
  if (d > 8.0) return null;
  const mode = settlement.response;
  if (mode === "withdraw")
    return "A cautious stillness from inside the water house. The door remains barred.";
  if (mode === "check-water")
    return "The caretaker murmurs softly, looking down at the dry trough: 'If only the springs ran true...'";
  if (mode === "welcome") {
    if (settlement.bowl > 0.05)
      return "The caretaker waves warmly: 'Fresh water for you, little friend. Rest your paws.'";
    return "The caretaker waves with a welcoming smile: 'Good to see you by the cistern, little one.'";
  }
  return "The caretaker observes you quietly from the doorway, curious and still.";
}

