import { test } from "node:test";
import assert from "node:assert/strict";
import { mulberry32, hash2i } from "../src/rng.js";
test("Living Frontier RNG repeats a seeded sequence", () => {
  const a = mulberry32(1337),
    b = mulberry32(1337);
  for (let i = 0; i < 10000; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});
test("chunk seeds distinguish coordinates and repeat", () => {
  assert.equal(hash2i(-2, 3, 1337), hash2i(-2, 3, 1337));
  assert.notEqual(hash2i(-2, 3, 1337), hash2i(3, -2, 1337));
});

import * as THREE from "three";
import { WorldState } from "../src/worldstate.js";
import { Streaming } from "../src/streaming.js";
import { Loop } from "../src/loop.js";
import { save, load } from "../src/persistence.js";
import { heightAt } from "../src/worldgen.js";
test("LF terrain is deterministic and finite across negative/positive coordinates", () => {
  for (let x = -1000; x <= 1000; x += 100) {
    assert.ok(Number.isFinite(heightAt(x, x / 2)));
    assert.equal(heightAt(x, x / 2), heightAt(x, x / 2));
  }
});
test("100 streamed crossings dispose replaced chunk geometry and retain nine chunks", () => {
  const scene = new THREE.Scene(),
    streaming = new Streaming(scene, new WorldState());
  let disposed = 0;
  const original = streaming.chunks.onChunkBuild;
  streaming.chunks.onChunkBuild = (key, rec) => {
    original();
    rec.mesh.geometry.addEventListener("dispose", () => disposed++);
  };
  for (let i = 0; i < 100; i++) {
    const x = ((i % 8) - 4) * 180;
    do {
      streaming.update(x, 0);
    } while (streaming.chunks.queue.length);
    assert.equal(streaming.stats().active, 9);
    assert.equal(scene.children.length, 9);
    assert.equal(streaming.loads - disposed, 9);
  }
  streaming.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(disposed, streaming.loads);
  assert.equal(streaming.stats().queued, 0);
});
test("fixed-step loop bounds tab-resume work and samples raw timing", () => {
  let ticks = 0,
    renders = 0;
  const loop = new Loop(
    (dt) => {
      assert.equal(dt, 1 / 60);
      ticks++;
    },
    () => renders++,
  );
  loop.frame(0);
  loop.frame(10000);
  assert.ok(ticks >= 5 && ticks <= 6);
  assert.equal(renders, 2);
  assert.equal(loop.frames[0], 10000);
  loop.reset();
  loop.frame(20000);
  assert.equal(renders, 3);
});
test("semantic save roundtrip excludes scenes; damaged original and live state remain intact", () => {
  let text;
  const storage = {
    setItem: (_, value) => (text = value),
    getItem: () => text,
  };
  const a = new WorldState();
  a.player.x = 98;
  a.elapsed = 20;
  assert.equal(save(a, storage).ok, true);
  assert.deepEqual(Object.keys(JSON.parse(text)).sort(), [
    "ecoRemainder",
    "ecosystem",
    "elapsed",
    "frontierReturn",
    "place",
    "player",
    "savedAt",
    "seed",
    "version",
    "watershed",
  ]);
  const b = new WorldState();
  assert.equal(load(b, storage, { offline: false }).ok, true);
  assert.deepEqual(b.snapshot(), a.snapshot());
  text = "{broken";
  const before = b.snapshot();
  assert.equal(load(b, storage, { offline: false }).ok, false);
  assert.equal(text, "{broken");
  assert.deepEqual(b.snapshot(), before);
});
test("blocked storage is reported rather than silently accepted", () => {
  const blocked = {
    setItem() {
      throw new Error("quota");
    },
    getItem() {
      throw new Error("blocked");
    },
  };
  assert.equal(save(new WorldState(), blocked).ok, false);
  assert.equal(load(new WorldState(), blocked).ok, false);
});
