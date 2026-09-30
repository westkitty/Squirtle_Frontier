import { CHANNEL_BOUNDS } from "./simulation/channel-terrain.js";
import { WORLD } from "./worldgen.js";
import { ChunkManager, makeGroundTexture, shared } from "./terrain.js";
export class Streaming {
  constructor(scene, state) {
    this.state = state;
    this.terrainStage = state.frontier?.stage ?? 0;
    this.texture = makeGroundTexture(state);
    this.chunks = new ChunkManager(scene, state);
    this.chunks.radius = 1; // one small baseline region; no ecology/actors yet
    this.loads = 0;
    this.unloads = 0;
    this.chunks.onChunkBuild = () => this.loads++;
    this.chunks.onChunkRemove = () => this.unloads++;
  }
  refreshTerrain() {
    this.terrainStage = this.state.frontier?.stage ?? 0;
    // Invalidate only channel-overlapping chunks. Normal queue owns reconstruction.
    const b = CHANNEL_BOUNDS;
    for (const [key, rec] of [...this.chunks.chunks]) {
      if (
        (rec.i + 1) * WORLD.chunk >= b.minX &&
        rec.i * WORLD.chunk <= b.maxX &&
        (rec.j + 1) * WORLD.chunk >= b.minZ &&
        rec.j * WORLD.chunk <= b.maxZ
      )
        this.chunks.disposeChunk(key);
    }
    this.chunks.center = { i: 9999, j: 9999 };
  }
  update(x, z) {
    if (this.terrainStage !== (this.state.frontier?.stage ?? 0))
      this.refreshTerrain();
    this.chunks.update(x, z, 2);
  }
  stats() {
    return {
      active: this.chunks.chunks.size,
      queued: this.chunks.queue.length,
      loads: this.loads,
      unloads: this.unloads,
    };
  }
  suspend() {
    for (const key of [...this.chunks.chunks.keys()])
      this.chunks.disposeChunk(key);
    this.chunks.queue.length = 0;
    this.chunks.center = { i: 9999, j: 9999 };
  }
  dispose() {
    this.suspend();
    this.chunks.material.dispose();
    this.texture.dispose();
    if (shared.uGround.value === this.texture) shared.uGround.value = null;
  }
}
