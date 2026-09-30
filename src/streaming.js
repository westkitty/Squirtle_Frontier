import { ChunkManager, makeGroundTexture, shared } from "./terrain.js";
export class Streaming {
  constructor(scene, state) {
    this.texture = makeGroundTexture(state);
    this.chunks = new ChunkManager(scene, state);
    this.chunks.radius = 1; // one small baseline region; no ecology/actors yet
    this.loads = 0;
    this.unloads = 0;
    this.chunks.onChunkBuild = () => this.loads++;
    this.chunks.onChunkRemove = () => this.unloads++;
  }
  update(x, z) {
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
  dispose() {
    for (const key of [...this.chunks.chunks.keys()])
      this.chunks.disposeChunk(key);
    this.chunks.queue.length = 0;
    this.chunks.material.dispose();
    this.texture.dispose();
    if (shared.uGround.value === this.texture) shared.uGround.value = null;
  }
}
