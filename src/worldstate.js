import { Settlement } from "./simulation/settlement.js";
// Single semantic state owner; body physics remains separate from the one-second regional tick.
import { channelHeight } from "./simulation/channel-terrain.js";
import { FrontierSystems } from "./simulation/frontier-systems.js";
import { PlaceMemory } from "./simulation/place-memory.js";
import { Ecosystem } from "./simulation/ecosystem.js";
import { Watershed } from "./simulation/watershed.js";
import { WORLD } from "./worldgen.js";
export class WorldState {
  constructor() {
    this.version = 6;
    this.seed = WORLD.seed;
    this.elapsed = 0;
    this.watershed = new Watershed();
    this.frontier = new FrontierSystems(this.seed);
    this.settlement = new Settlement();
    this.memory = new PlaceMemory(this.seed);
    this.ecosystem = new Ecosystem(this.seed);
    this.ecoRemainder = 0;
    this.place = "frontier";
    this.frontierReturn = { x: -10, z: 18 };
    this.player = { x: -10, z: 18 };
    // Full body pose, scoped to the place it was recorded in. Saving x/z alone
    // would drop a body straight through a basin floor.
    this.pose = null;
    this.ground = new Uint8Array(WORLD.stateRes * WORLD.stateRes * 4);
  }
  sampleHeight(x, z) {
    return channelHeight(x, z, this.frontier.stage);
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt < 0 || dt > 1)
      throw new Error("Invalid world step");
    this.elapsed += dt;
    this.ecoRemainder += dt;
    if (this.ecoRemainder >= 1 - 1e-9) {
      this.ecoRemainder = Math.max(0, this.ecoRemainder - 1);
      if (this.ecoRemainder < 1e-9) this.ecoRemainder = 0;
      const forcing = this.frontier.advance();
      this.watershed.update(1, forcing);
      this.ecosystem.tick(this.watershed);
      this.settlement.tick(this.ecosystem);
      this.frontier.record(this.watershed, this.ecosystem);
    }
  }
  snapshot() {
    // Explicit semantic allowlist: never serialize the renderer or imported nodes.
    return {
      version: this.version,
      seed: this.seed,
      elapsed: this.elapsed,
      player: { ...this.player },
      pose: this.pose ? { ...this.pose } : null,
      watershed: this.watershed.snapshot(),
      ecosystem: this.ecosystem.snapshot(),
      frontier: this.frontier.snapshot(),
      memory: this.memory.snapshot(),
      settlement: this.settlement.snapshot(),
      ecoRemainder: this.ecoRemainder,
      place: this.place,
      frontierReturn: { ...this.frontierReturn },
    };
  }
}
