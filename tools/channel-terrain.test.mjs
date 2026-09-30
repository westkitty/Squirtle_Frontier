import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  CHANNEL_ROUTE,
  CHANNEL_DEPTH,
  channelHeight,
  channelSample,
} from "../src/simulation/channel-terrain.js";
import { heightAt } from "../src/worldgen.js";
import { WorldState } from "../src/worldstate.js";
import { Streaming } from "../src/streaming.js";
import { createBody } from "../src/player/body-state.js";
import { stepBody } from "../src/player/squirtle-controller.js";
import { advanceOffline, save, load } from "../src/persistence.js";
test("each stage carves only a bounded local groove, and depth is monotone", () => {
  for (const p of CHANNEL_ROUTE)
    for (let stage = 0; stage < 5; stage++) {
      assert.ok(
        Math.abs(
          channelHeight(p.x, p.z, stage) -
            (heightAt(p.x, p.z) - CHANNEL_DEPTH[stage]),
        ) < 1e-10,
      );
      const sample = channelSample(p.x, p.z, stage);
      for (const n of Object.values(sample)) assert.ok(Number.isFinite(n));
    }
  for (const [x, z] of [
    [-40, -40],
    [40, 40],
    [-10, 30],
    [0, 0],
  ])
    for (let stage = 0; stage < 5; stage++)
      assert.equal(channelHeight(x, z, stage), heightAt(x, z));
});
test("chunk render vertices equal authoritative contact height after stage refresh", () => {
  const scene = new THREE.Scene(),
    s = new WorldState(),
    stream = new Streaming(scene, s);
  const settle = () => {
    do {
      stream.update(-10, 10);
    } while (stream.stats().queued);
  };
  settle();
  const old = stream.chunks.chunks.get("-1,0").mesh.geometry;
  let disposed = false;
  old.addEventListener("dispose", () => (disposed = true));
  s.frontier.bypass = 1;
  s.frontier.channelErosion = 12;
  stream.refreshTerrain();
  settle();
  assert.equal(disposed, true);
  for (const rec of stream.chunks.chunks.values()) {
    const p = rec.mesh.geometry.attributes.position;
    for (let i = 0; i < p.count; i++)
      assert.ok(
        Math.abs(
          p.getY(i) -
            s.sampleHeight(
              rec.mesh.position.x + p.getX(i),
              rec.mesh.position.z + p.getZ(i),
            ),
        ) < 1e-5,
      );
  }
  assert.equal(stream.stats().active, 9);
  stream.dispose();
  assert.equal(scene.children.length, 0);
});
test("stage transition body settles to reconstructed ground; save/load reconstructs groove", () => {
  const s = new WorldState();
  s.frontier.bypass = 1;
  advanceOffline(s, 1200);
  assert.equal(s.frontier.stage, 4);
  const p = CHANNEL_ROUTE[0],
    b = createBody(p.x, p.z, heightAt(p.x, p.z));
  const env = {
    sample: (x, z) => channelSample(x, z, s.frontier.stage),
    water: () => null,
    obstacles: [],
  };
  for (let i = 0; i < 60; i++) stepBody(b, { x: 0, z: 0 }, env, 1 / 60);
  assert.equal(b.y, s.sampleHeight(b.x, b.z));
  assert.equal(b.grounded, true);
  const m = new Map(),
    storage = { getItem: (k) => m.get(k), setItem: (k, v) => m.set(k, v) };
  assert.equal(save(s, storage, 1).ok, true);
  const r = new WorldState();
  assert.equal(load(r, storage, { offline: false }).ok, true);
  assert.equal(r.sampleHeight(p.x, p.z), s.sampleHeight(p.x, p.z));
});

test("stream update detects externally changed stage including first jet groove without a tick", () => {
  const s = new WorldState(),
    stream = new Streaming(new THREE.Scene(), s);
  do {
    stream.update(-10, 10);
  } while (stream.stats().queued);
  const original = stream.chunks.chunks.get("-1,0");
  s.frontier.bypass = 0.01;
  do {
    stream.update(-10, 10);
  } while (stream.stats().queued);
  assert.notEqual(stream.chunks.chunks.get("-1,0"), original);
  assert.equal(stream.terrainStage, 1);
  const outside = stream.chunks.chunks.get("0,-1");
  s.frontier.channelErosion = 3.1;
  do {
    stream.update(-10, 10);
  } while (stream.stats().queued);
  assert.equal(stream.chunks.chunks.get("0,-1"), outside);
  stream.dispose();
});
