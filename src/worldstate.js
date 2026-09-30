// Single semantic state owner; body physics remains separate from the one-second regional tick.
import { Ecosystem } from "./simulation/ecosystem.js";
import { Watershed } from "./simulation/watershed.js";
import { WORLD } from "./worldgen.js";
export class WorldState {
  constructor() {
    this.version = 3;
    this.seed = WORLD.seed;
    this.elapsed = 0;
    this.watershed = new Watershed();
    this.ecosystem = new Ecosystem(this.seed);
    this.ecoRemainder = 0;
    this.place = "frontier";
    this.frontierReturn = { x: -10, z: 18 };
    this.player = { x: -10, z: 18 };
    this.ground = new Uint8Array(WORLD.stateRes * WORLD.stateRes * 4);
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt < 0 || dt > 1)
      throw new Error("Invalid world step");
    this.elapsed += dt;
    this.ecoRemainder += dt;
    if (this.ecoRemainder >= 1 - 1e-9) {
      this.ecoRemainder = Math.max(0, this.ecoRemainder - 1);
      if (this.ecoRemainder < 1e-9) this.ecoRemainder = 0;
      this.watershed.update(1);
      this.ecosystem.tick(this.watershed);
    }
  }
  snapshot() {
    // Explicit semantic allowlist: never serialize the renderer or imported nodes.
    return {
      version: this.version,
      seed: this.seed,
      elapsed: this.elapsed,
      player: { ...this.player },
      watershed: this.watershed.snapshot(),
      ecosystem: this.ecosystem.snapshot(),
      ecoRemainder: this.ecoRemainder,
      place: this.place,
      frontierReturn: { ...this.frontierReturn },
    };
  }
}
