// Reduced Phase 0 state owner. LF's regional simulation is deliberately not activated yet.
import { Watershed } from "./simulation/watershed.js";
import { WORLD } from "./worldgen.js";
export class WorldState {
  constructor() {
    this.version = 2;
    this.seed = WORLD.seed;
    this.elapsed = 0;
    this.watershed = new Watershed();
    this.player = { x: -10, z: 18 };
    this.ground = new Uint8Array(WORLD.stateRes * WORLD.stateRes * 4);
  }
  update(dt) {
    this.elapsed += dt;
    this.watershed.update(dt);
  }
  snapshot() {
    // Explicit semantic allowlist: never serialize the renderer or imported nodes.
    return {
      version: this.version,
      seed: this.seed,
      elapsed: this.elapsed,
      player: { ...this.player },
      watershed: this.watershed.snapshot(),
    };
  }
}
