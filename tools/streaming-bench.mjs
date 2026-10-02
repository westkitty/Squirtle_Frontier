// Locomotion Zero, stage 7: the amortization benchmark, matched pair.
//
// "Amortized" is only a claim if the same walk is run under both policies and the same
// quantity is measured. The quantity here is height samples per frame, because that is
// what a chunk build actually is: n*n noise evaluations. Wall-clock milliseconds are
// reported alongside, but they are not the assertion - they belong to whichever
// container runs this file, and a benchmark that fails on a slow machine measures
// nothing about the policy.
//
// Policy A is the count budget the game used (two chunks per frame, whatever those two
// chunks cost, old mesh torn down before the new one exists). Policy B is the sample
// budget with held swaps. Both walk the identical line, and the totals have to come out
// equal, or the comparison is meaningless.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import * as THREE from "three";
import { ChunkManager, TERRAIN_BUDGET } from "../src/terrain.js";
import { heightAt } from "../src/worldgen.js";
import {
  CHANNEL_ROUTE,
  channelHeight,
} from "../src/simulation/channel-terrain.js";

const C = 24; // WORLD.chunk, restated so the walk length is legible
const STEPS = 420,
  SPEED = 0.5;
// The groove sits inside one chunk (x -10..-7, z 10), so walking *along* it never
// crosses a boundary. What matters is crossing the chunk it lives in, which is where
// the game demands a 128-segment chunk - the frame where a count budget of "two
// chunks" meant seventeen thousand noise evaluations at once.
const CHANNEL_Z =
    (Math.min(...CHANNEL_ROUTE.map((p) => p.z)) +
      Math.max(...CHANNEL_ROUTE.map((p) => p.z))) /
    2,
  walkAt = (name, step) =>
    name.indexOf("channel") >= 0
      ? { x: -36 + step * SPEED, z: CHANNEL_Z }
      : { x: step * SPEED, z: 18 };

function run(label, budget, stage) {
  const state = {
      frontier: { stage },
      sampleHeight:
        stage > 0
          ? (x, z) => channelHeight(x, z, stage)
          : (x, z) => heightAt(x, z),
    },
    root = new THREE.Scene(),
    chunks = new ChunkManager(root, state, { budget });
  chunks.radius = 1;
  const perFrame = [];
  let loads = 0,
    frames = 0,
    started = performance.now();
  chunks.onChunkBuild = () => loads++;
  for (let step = 0; step < STEPS; step++) {
    const p = walkAt(label, step),
      before = chunks.work.samples;
    chunks.update(p.x, p.z, budget.maxChunksPerFrame, { vx: SPEED, vz: 0 });
    perFrame.push(chunks.work.samples - before);
    frames++;
  }
  for (let i = 0; i < 40 && chunks.queue.length; i++) {
    const before = chunks.work.samples;
    chunks.pump(budget.maxChunksPerFrame);
    perFrame.push(chunks.work.samples - before);
  }
  const wallMs = performance.now() - started,
    sorted = perFrame.slice().sort((a, b) => a - b),
    result = {
      label,
      frames,
      totalSamples: chunks.work.samples,
      medianFrame: sorted[Math.floor(sorted.length / 2)],
      p95Frame: sorted[Math.floor(sorted.length * 0.95)],
      maxFrame: sorted.at(-1),
      holes: chunks.work.holes,
      active: chunks.chunks.size,
      builds: loads,
      wallMs: +wallMs.toFixed(1),
      msPerFrame: +(wallMs / frames).toFixed(3),
    };
  for (const key of [...chunks.chunks.keys()]) chunks.disposeChunk(key);
  assert.equal(root.children.length, 0, `${label} left geometry in the scene`);
  assert.equal(chunks.pendingSwaps, 0, `${label} leaked a held swap`);
  return result;
}

const OLD = {
  heightSamples: Infinity,
  maxChunksPerFrame: 2,
  pendingSwaps: 0,
};
const openA = run("open country, count budget", OLD, 0);
const openB = run("open country, sample budget", { ...TERRAIN_BUDGET }, 0);
const cutA = run("carved channel, count budget", OLD, 2);
const cutB = run("carved channel, sample budget", { ...TERRAIN_BUDGET }, 2);

// Matched work: the same line, crossed the same number of times, has to ship exactly
// the same set of chunks - otherwise one policy is quietly doing more terrain than the
// other and the frame comparison means nothing.
function compare(a, b, name, mustImprove) {
  assert.equal(
    a.builds,
    b.builds,
    `${name}: the policies shipped ${a.builds} and ${b.builds} chunks for one walk`,
  );
  const drift = Math.abs(a.totalSamples - b.totalSamples) / a.totalSamples;
  assert.ok(
    drift < 0.05,
    `${name}: total terrain work differs by ${(drift * 100).toFixed(1)}%, so the runs are not matched`,
  );
  assert.ok(
    b.maxFrame <= TERRAIN_BUDGET.heightSamples + 130,
    `${name}: a single frame spent ${b.maxFrame} samples against a ${TERRAIN_BUDGET.heightSamples} budget`,
  );
  if (mustImprove)
    assert.ok(
      b.maxFrame < a.maxFrame,
      `${name}: the worst frame did not improve (${a.maxFrame} -> ${b.maxFrame})`,
    );
  else
    assert.ok(
      b.maxFrame <= a.maxFrame,
      `${name}: the worst frame got worse (${a.maxFrame} -> ${b.maxFrame})`,
    );
  assert.equal(
    b.holes,
    0,
    `${name}: ${b.holes} frames had no ground under the body`,
  );
  assert.ok(b.totalSamples > 0, `${name}: measured nothing`);
  assert.equal(
    a.active,
    9,
    `${name}: open region did not settle at nine chunks`,
  );
  assert.equal(
    b.active,
    9,
    `${name}: amortized region did not settle at nine chunks`,
  );
  return drift;
}
const openDrift = compare(openA, openB, "open country", false);
const cutDrift = compare(cutA, cutB, "carved channel", true);

await mkdir("docs/performance", { recursive: true });
await writeFile(
  "docs/performance/streaming-bench.json",
  JSON.stringify(
    {
      note: "Height samples per renderer frame along matched walks across chunk boundaries. Frame maxima are the policy claim; wall-clock here is a software-rasterizer container and is not device performance evidence.",
      chunk: C,
      walk: {
        steps: STEPS,
        metres: +(STEPS * SPEED).toFixed(0),
        boundaries: Math.round((STEPS * SPEED) / C),
      },
      walks: {
        "open-country": {
          before: openA,
          after: openB,
          driftPercent: +(openDrift * 100).toFixed(2),
        },
        "carved-channel": {
          before: cutA,
          after: cutB,
          driftPercent: +(cutDrift * 100).toFixed(2),
        },
      },
      budget: TERRAIN_BUDGET,
    },
    null,
    2,
  ),
);
const line = (name, a, b) =>
  `${name.padEnd(16)} worst frame ${String(a.maxFrame).padStart(6)} -> ${String(b.maxFrame).padStart(6)} samples (median ${a.medianFrame} -> ${b.medianFrame}), ${a.builds} chunk builds, holes ${a.holes} -> ${b.holes}, ${a.msPerFrame} -> ${b.msPerFrame} ms/frame`;
console.log(
  `\nmatched walk: ${(STEPS * SPEED).toFixed(0)} m, ${Math.round((STEPS * SPEED) / C)} chunk boundaries, same terrain shipped`,
);
console.log(line("open country", openA, openB));
console.log(line("carved channel", cutA, cutB));
console.log(
  "wall clock is reported, not asserted (software rasterizer in a container, not device evidence)",
);
console.log("docs/performance/streaming-bench.json written.");
