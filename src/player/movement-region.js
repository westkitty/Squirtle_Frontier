import { heightAt, WORLD } from "../worldgen.js";
import { hash2i, mulberry32 } from "../rng.js";
export const obstacles = [
  { x: -10, z: -8, radius: 1.4, height: 2.2 },
  { x: 13, z: 8, radius: 1.1, height: 1.6 },
  { x: -17, z: 20, radius: 2, height: 2.5 },
];
export function sampleGround(x, z) {
  const e = 0.15;
  return {
    height: heightAt(x, z),
    dx: (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e),
    dz: (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e),
  };
}
export function waterAt(x, z) {
  return (x / 10) ** 2 + (z / 31) ** 2 < 1 && heightAt(x, z) < -0.05
    ? { level: 0, currentX: 0.08, currentZ: -0.18 }
    : null;
}
export function treesForChunk(i, j) {
  const random = mulberry32(Math.floor(hash2i(i, j, 1337) * 0xffffffff)),
    trees = [];
  for (let n = 0; n < 28; n++) {
    const x = i * WORLD.chunk + random() * WORLD.chunk,
      z = j * WORLD.chunk + random() * WORLD.chunk;
    if (
      heightAt(x, z) > 0.4 &&
      Math.abs(x) > 10 &&
      Math.hypot(x + 10, z - 18) > 4
    )
      trees.push({ x, z, h: 5 + random() * 7 });
  }
  return trees;
}
const colliderCache = new Map();
export function obstaclesAt(x, z) {
  const result = [...obstacles],
    ci = Math.floor(x / WORLD.chunk),
    cj = Math.floor(z / WORLD.chunk);
  for (let j = cj - 1; j <= cj + 1; j++)
    for (let i = ci - 1; i <= ci + 1; i++) {
      const key = `${i},${j}`;
      if (!colliderCache.has(key)) {
        colliderCache.set(
          key,
          treesForChunk(i, j).map((t) => ({
            x: t.x,
            z: t.z,
            radius: 0.32,
            height: t.h,
          })),
        );
        if (colliderCache.size > 16)
          colliderCache.delete(colliderCache.keys().next().value);
      }
      result.push(...colliderCache.get(key));
    }
  return result;
}
export const region = {
  sample: sampleGround,
  water: waterAt,
  obstacles,
  obstaclesAt,
};
