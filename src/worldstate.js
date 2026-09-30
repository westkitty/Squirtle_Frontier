// Reduced Phase 0 state owner. LF's regional simulation is deliberately not activated yet.
import { WORLD } from './worldgen.js';
export class WorldState {
  constructor() {
    this.version = 1;
    this.seed = WORLD.seed;
    this.elapsed = 0;
    this.player = { x: -140, z: 306 };
    this.ground = new Uint8Array(WORLD.stateRes * WORLD.stateRes * 4);
  }
  update(dt) { this.elapsed += dt; }
  snapshot() {
    // Explicit semantic allowlist: never serialize the renderer or imported nodes.
    return { version: this.version, seed: this.seed, elapsed: this.elapsed, player: { ...this.player } };
  }
}
