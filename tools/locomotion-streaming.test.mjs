// Locomotion Zero, stage 7: streaming that spends a bounded amount of work per frame
// and never leaves the body standing on nothing while it does.
//
// The tests are built on a cheap synthetic height field so the assertions are about the
// pump's bookkeeping rather than the noise pipeline's cost, except where the point
// really is the cost (the per-frame bound). The one thing that must be true above all:
// amortizing the build must not change a single vertex.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ChunkManager, TERRAIN_BUDGET } from "../src/terrain.js";
import { WORLD } from "../src/worldgen.js";
import { CHANNEL_ROUTE } from "../src/simulation/channel-terrain.js";
import { Streaming } from "../src/streaming.js";

const C = WORLD.chunk;
const terrain = (scale = 1) => ({
  frontier: { stage: 0 },
  sampleHeight: (x, z) => (Math.sin(x * 0.1) + Math.cos(z * 0.13)) * 3 * scale,
});
const centerOf = (chunkI, chunkJ) => ({
  x: (chunkI + 0.5) * C,
  z: (chunkJ + 0.5) * C,
});
// A frame is one `update` call; the queue is what has not landed yet.
function frames(chunks, n, motion = null) {
  const spent = [];
  for (let i = 0; i < n; i++) {
    const before = chunks.work.samples;
    chunks.pump();
    spent.push(chunks.work.samples - before);
  }
  return spent;
}
const channelCell = (() => {
  const p = CHANNEL_ROUTE[Math.floor(CHANNEL_ROUTE.length / 2)];
  return { i: Math.floor(p.x / C), j: Math.floor(p.z / C) };
})();

test("a band-built chunk is the same chunk, vertex for vertex", () => {
  const state = terrain();
  const sync = new ChunkManager(new THREE.Scene(), state);
  sync.radius = 1;
  const slow = new ChunkManager(new THREE.Scene(), state, {
    budget: { ...TERRAIN_BUDGET, heightSamples: 97 },
  });
  slow.radius = 1;
  const at = centerOf(2, -3);
  slow.update(at.x, at.z, 1);
  let guard = 0;
  while (slow.queue.length && guard++ < 400) slow.pump(1);
  const b = slow.chunks.get("2,-3");
  assert.ok(b, "the banded path produced nothing");
  sync.buildChunk(2, -3, b.lod, 0);
  const a = sync.chunks.get("2,-3");
  assert.ok(a && b, "neither path produced the chunk");
  assert.equal(a.lod, b.lod, "the paths were not asked for the same chunk");
  assert.deepEqual(
    Array.from(b.heights),
    Array.from(a.heights),
    "the height field differs between a banded build and a single-pass one",
  );
  for (const attr of ["position", "normal", "color"])
    assert.deepEqual(
      Array.from(b.mesh.geometry.getAttribute(attr).array),
      Array.from(a.mesh.geometry.getAttribute(attr).array),
      `${attr} differs`,
    );
  assert.deepEqual(
    Array.from(b.mesh.geometry.index.array),
    Array.from(a.mesh.geometry.index.array),
    "indices differ",
  );
  assert.ok(
    guard > 4,
    `a 97-sample budget finished in ${guard} frames - not amortized`,
  );
});

test("no frame spends more than the budget, whatever two chunks land", () => {
  const state = terrain();
  const chunks = new ChunkManager(new THREE.Scene(), state, {
    budget: { ...TERRAIN_BUDGET, pendingSwaps: 0 },
  });
  chunks.radius = 1;
  // Inside the channel bounds the ring-0 chunk is 128 segments: 16,641 samples, which
  // is the frame the old count budget could put two of in a row.
  state.frontier.stage = 2;
  const at = centerOf(channelCell.i, channelCell.j);
  chunks.update(at.x, at.z, 4);
  const spent = frames(chunks, 30);
  const heaviest = Math.max(...spent);
  assert.ok(
    heaviest <= TERRAIN_BUDGET.heightSamples + 130,
    `a frame spent ${heaviest} samples against ${TERRAIN_BUDGET.heightSamples}`,
  );
  assert.ok(
    heaviest > TERRAIN_BUDGET.heightSamples * 0.5,
    `${heaviest}: the budget was never used`,
  );
  let landed = 0;
  for (let i = 0; i < 200 && chunks.queue.length; i++) {
    const before = chunks.work.samples;
    chunks.pump();
    assert.ok(
      chunks.work.samples - before <= TERRAIN_BUDGET.heightSamples + 130,
    );
    landed++;
  }
  assert.equal(
    chunks.queue.length,
    0,
    `the region never settled in ${landed} frames`,
  );
});

test("a chunk that is already there is never rebuilt by a passing frame", () => {
  const state = terrain();
  const chunks = new ChunkManager(new THREE.Scene(), state);
  chunks.radius = 1;
  const at = centerOf(-1, 4);
  chunks.update(at.x, at.z, 64);
  for (let i = 0; i < 400 && chunks.queue.length; i++) chunks.pump();
  assert.equal(chunks.chunks.size, 9, "the region never settled");
  const after = chunks.work.samples,
    built = new Set(chunks.chunks.keys());
  for (let i = 0; i < 8; i++) chunks.update(at.x + 0.25, at.z, 64);
  assert.equal(chunks.work.samples, after, "an idle frame did terrain work");
  assert.deepEqual(
    new Set(chunks.chunks.keys()),
    built,
    "chunks churned while standing still",
  );
  // And a chunk half-built resumes: a re-plan that keeps the same task must not
  // re-sample rows it already has.
  const slow = new ChunkManager(new THREE.Scene(), state, {
    budget: { ...TERRAIN_BUDGET, heightSamples: 200 },
  });
  slow.radius = 1;
  slow.update(at.x, at.z, 1);
  const half = slow.queue[0];
  assert.ok(half.rec.rows > 0, "nothing was in flight to carry over");
  const before = slow.work.samples;
  slow.rebuildList(slow.center.i, slow.center.j, null);
  assert.equal(
    slow.queue[0].rec,
    half.rec,
    "the half-built chunk was thrown away",
  );
  assert.equal(slow.work.samples, before, "a re-plan costs samples of its own");
});

test("the ground under the body is never missing while a swap is in flight", () => {
  const state = terrain();
  const scene = new THREE.Scene();
  const chunks = new ChunkManager(scene, state, {
    budget: { ...TERRAIN_BUDGET, heightSamples: 400, maxChunksPerFrame: 1 },
  });
  chunks.radius = 1;
  const from = centerOf(channelCell.i - 1, channelCell.j),
    to = centerOf(channelCell.i, channelCell.j);
  state.frontier.stage = 0;
  chunks.update(from.x, from.z, 64);
  for (let i = 0; i < 4000 && chunks.queue.length; i++) chunks.pump();
  assert.equal(chunks.work.holes, 0, "the cold fill was counted as a hole");
  const meshes = scene.children.length;
  // Now carve, and step onto the carved chunk: it has to become 128 segments, and
  // while it is being built the old mesh has to stay in the scene.
  state.frontier.stage = 2;
  chunks.update(to.x, to.z, null);
  let missing = 0,
    held = 0,
    pendingPeak = 0;
  const key = chunks.keyOf(channelCell.i, channelCell.j),
    original = chunks.chunks.get(key)?.mesh;
  assert.ok(original, "the region was not settled before the swap");
  for (let i = 0; i < 4000; i++) {
    chunks.pump();
    const now = chunks.chunks.get(key);
    if (!now) missing++;
    else if (now.mesh === original) held++;
    pendingPeak = Math.max(pendingPeak, chunks.pendingSwaps);
    if (!chunks.queue.length) break;
  }
  assert.equal(missing, 0, "the chunk under the body vanished mid-swap");
  assert.ok(
    held > 3,
    "the coarse mesh was dropped before the refined one existed",
  );
  assert.equal(pendingPeak, 1, "the swap was not accounted as a held mesh");
  assert.equal(
    chunks.chunks.get(key).lod,
    128,
    "the carved chunk never refined",
  );
  assert.notEqual(
    chunks.chunks.get(key).mesh,
    original,
    "the mesh was never replaced",
  );
  assert.ok(chunks.pendingSwaps === 0, "the held swap was not released");
  // And crossing the same boundary at a crawl, the body's chunk exists on every frame.
  for (const k of [...chunks.chunks.keys()]) chunks.disposeChunk(k);
  chunks.queue.length = 0;
  chunks.work.holes = 0;
  state.frontier.stage = 0;
  chunks.update(from.x, from.z, 64);
  for (let i = 0; i < 4000 && chunks.queue.length; i++) chunks.pump();
  const before = chunks.work.holes;
  for (let x = from.x; x < to.x + 4; x += 0.5) {
    chunks.update(x, from.z, null);
    chunks.pump();
  }
  assert.equal(
    chunks.work.holes,
    before,
    "a boundary crossing left the body unsupported",
  );
});

test("held swaps are bounded, so a stage rebuild cannot fill the scene", () => {
  const state = terrain();
  const scene = new THREE.Scene();
  const chunks = new ChunkManager(scene, state, {
    budget: {
      ...TERRAIN_BUDGET,
      heightSamples: 60,
      maxChunksPerFrame: 1,
      pendingSwaps: 2,
    },
  });
  chunks.radius = 2;
  const at = centerOf(1, 1);
  chunks.update(at.x, at.z, 64);
  for (let i = 0; i < 4000 && chunks.queue.length; i++) chunks.pump();
  const settled = scene.children.length;
  state.frontier.stage = 2; // every wanted chunk now changes LOD at once
  chunks.update(at.x, at.z, null);
  let peak = 0;
  for (let i = 0; i < 400; i++) {
    chunks.pump();
    peak = Math.max(peak, scene.children.length - settled);
    if (!chunks.queue.length) break;
  }
  assert.ok(
    peak <= TERRAIN_BUDGET.pendingSwaps,
    `${peak} extra geometries were alive at once, against a bound of ${TERRAIN_BUDGET.pendingSwaps}`,
  );
  assert.ok(chunks.pendingSwaps === 0, "the held-swap counter drifted");
  for (const k of [...chunks.chunks.keys()]) chunks.disposeChunk(k);
  assert.equal(scene.children.length, 0, "teardown left geometry behind");
});

test("ground the body is heading into is queued ahead of ground it is leaving", () => {
  const state = terrain();
  const chunks = new ChunkManager(new THREE.Scene(), state);
  chunks.radius = 1;
  const at = centerOf(0, 0);
  chunks.rebuildList(0, 0, { vx: 1, vz: 0 });
  const first = chunks.queue[0];
  assert.equal(first.i, 1, "the eastward neighbour was not prioritised");
  assert.equal(first.j, 0);
  chunks.queue.length = 0;
  chunks.rebuildList(0, 0, { vx: 0, vz: -1 });
  assert.equal(chunks.queue[0].j, -1, "and neither was the one behind");
  chunks.queue.length = 0;
  chunks.rebuildList(0, 0, { vx: 0, vz: 0 });
  assert.ok(
    chunks.queue.every((t) => t.d === t.i * t.i + t.j * t.j),
    "stillness must not bias",
  );
  chunks.queue.length = 0;
  chunks.rebuildList(0, 0, null);
  assert.ok(chunks.queue.length, "no motion still plans a region");
});

test("the streaming façade reports the amortization and can settle on demand", () => {
  const state = { ...terrain(), waterLevel: 0 };
  const scene = new THREE.Scene();
  const streaming = new Streaming(scene, state);
  const at = centerOf(-2, 2);
  streaming.update(at.x, at.z, { vx: 0.5, vz: 0 });
  const mid = streaming.stats();
  assert.ok(mid.queued > 0, "nothing was left in the queue to amortize");
  const done = streaming.settle(at.x, at.z);
  assert.equal(done.queued, 0, "settle() did not drain the queue");
  assert.equal(done.active, 9, "the baseline region is nine chunks");
  assert.equal(done.holes, 0);
  for (const key of ["held", "frames", "samples", "maxFrameSamples"])
    assert.ok(Number.isFinite(done[key]), `${key} is not reported`);
  assert.ok(
    done.maxFrameSamples <= TERRAIN_BUDGET.heightSamples + 130,
    "frame bound",
  );
  assert.ok(mid.samples <= done.samples, "the sample counter went backwards");
  streaming.dispose();
  assert.equal(
    scene.children.length,
    0,
    "streaming has to leave the scene clean",
  );
});

test("terrain revision keeps supported ground until the replacement is ready", () => {
  const state = terrain(),
    scene = new THREE.Scene(),
    chunks = new ChunkManager(scene, state);
  chunks.radius = 1;
  const streaming = Object.create(Streaming.prototype);
  Object.assign(streaming, { state, chunks, terrainStage: 0 });
  chunks.update(-8, 10);
  while (chunks.queue.length) chunks.pump();
  const key = "-1,0",
    original = chunks.chunks.get(key).mesh;
  state.frontier.stage = 2;
  streaming.update(-8, 10);
  assert.equal(chunks.chunks.get(key).mesh, original);
  assert.ok(chunks.queue.length > 0);
  while (chunks.queue.length) {
    chunks.pump();
    assert.ok(chunks.chunks.has(key), "terrain refresh left missing support");
  }
  assert.notEqual(chunks.chunks.get(key).mesh, original);
  assert.equal(scene.children.length, 9);
  assert.equal(chunks.work.holes, 0);
  assert.equal(chunks.pendingSwaps, 0);
  for (const k of [...chunks.chunks.keys()]) chunks.disposeChunk(k);
  chunks.material.dispose();
});
