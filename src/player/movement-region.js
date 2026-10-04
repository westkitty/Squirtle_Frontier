import { WATER_HOUSE } from "../simulation/settlement.js";
import { WATER_BASE, WATER_SHORELINE } from "../simulation/water-level.js";
import { heightAt, WORLD } from "../worldgen.js";
import { hash2i, mulberry32 } from "../rng.js";
export const obstacles = [
  { x: -10, z: -8, radius: 1.4, height: 2.2, ground: heightAt(-10, -8) },
  { x: 13, z: 8, radius: 1.1, height: 1.6, ground: heightAt(13, 8) },
  { x: -17, z: 20, radius: 2, height: 2.5, ground: heightAt(-17, 20) },
];
export function sampleGround(x, z) {
  const e = 0.15;
  return {
    height: heightAt(x, z),
    dx: (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e),
    dz: (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e),
  };
}
export function waterAt(x, z, level = WATER_BASE) {
  return (x / 10) ** 2 + (z / 31) ** 2 < 1 &&
    heightAt(x, z) < WATER_SHORELINE(level)
    ? { level, currentX: 0.08, currentZ: -0.18 }
    : null;
}
export function treesForChunk(i, j) {
  const random = mulberry32(Math.floor(hash2i(i, j, 1337) * 0xffffffff)),
    trees = [];
  for (let n = 0; n < 28; n++) {
    const x = i * WORLD.chunk + random() * WORLD.chunk,
      z = j * WORLD.chunk + random() * WORLD.chunk;
    if (
      Math.hypot(x - WATER_HOUSE.x, z - WATER_HOUSE.z) > 5 &&
      heightAt(x, z) > 0.4 &&
      Math.abs(x) > 10 &&
      Math.hypot(x + 10, z - 18) > 4
    )
      trees.push({ x, z, h: 5 + random() * 7 });
  }
  return trees;
}
const colliderCache = new Map();
export function fillObstaclesAt(x, z, result = []) {
  result.length = 0;
  for (let k = 0; k < obstacles.length; k++) result.push(obstacles[k]);
  const ci = Math.floor(x / WORLD.chunk),
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
            ground: heightAt(t.x, t.z),
          })),
        );
        if (colliderCache.size > 16)
          colliderCache.delete(colliderCache.keys().next().value);
      }
      const cached = colliderCache.get(key);
      for (let k = 0; k < cached.length; k++) result.push(cached[k]);
    }
  return result;
}
export function obstaclesAt(x, z) {
  return fillObstaclesAt(x, z, []);
}
export const region = {
  sample: sampleGround,
  water: waterAt,
  obstacles,
  obstaclesAt,
};
