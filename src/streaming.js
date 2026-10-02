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
        rec.dirty = true;
    }
    this.chunks.queue.length = 0;
    this.chunks.pendingSwaps = 0;
    this.chunks.center = { i: 9999, j: 9999 };
  }
  // `motion` is the body's velocity, used only to order work - it never decides what
  // exists, so a body that stops mid-crossing still gets its ground.
  update(x, z, motion = null) {
    if (this.terrainStage !== (this.state.frontier?.stage ?? 0))
      this.refreshTerrain();
    this.chunks.update(x, z, this.chunks.budget.maxChunksPerFrame, motion);
  }
  // Everything the queue can ask for, right now: boot and any test that wants the
  // region complete without stepping frames.
  settle() {
    let guard = 0;
    while (this.chunks.queue.length && guard++ < 4000) this.chunks.pump(64);
    return this.stats();
  }
  stats() {
    return {
      active: this.chunks.chunks.size,
      queued: this.chunks.queue.length,
      loads: this.loads,
      unloads: this.unloads,
      // The amortization itself: how much terrain work a single frame was allowed, how
      // many swaps are in flight, and whether the body was ever left unsupported.
      held: this.chunks.pendingSwaps,
      frames: this.chunks.work.frames,
      samples: this.chunks.work.samples,
      maxFrameSamples: this.chunks.work.maxSamples,
      holes: this.chunks.work.holes,
    };
  }
  suspend() {
    for (const key of [...this.chunks.chunks.keys()])
      this.chunks.disposeChunk(key);
    this.chunks.queue.length = 0;
    // Queued tasks may hold a mesh that is still in the map (disposed above) but their
    // half-built work and swap accounting have to go with them, or the counters drift
    // across a place change.
    this.chunks.pendingSwaps = 0;
    this.chunks.center = { i: 9999, j: 9999 };
  }
  dispose() {
    this.suspend();
    this.chunks.material.dispose();
    this.texture.dispose();
    if (shared.uGround.value === this.texture) shared.uGround.value = null;
  }
}
