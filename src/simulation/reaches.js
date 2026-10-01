import { heightAt } from "../worldgen.js";
import { CHANNEL_ROUTE } from "./channel-terrain.js";
// Named inflow routes read off the same terrain the body walks on. Nothing here is
// simulated, saved or carved: it is a way of *naming* the water the watershed
// already models, so following a channel downstream is something the player can
// read rather than guess.
export const WATER_LINE = -0.05;
export const REACH_RADIUS = 5;
// The same ellipse the movement region uses for open water, so "toward the water"
// means one thing in the tracer and in the world.
export const basinDistance = (x, z) => Math.hypot(x / 10, z / 31);
// Anchors chosen because each one actually drains: a route that stops short of the
// shallows would be a broken promise, so any that fails is dropped at build time.
export const REACH_SOURCES = Object.freeze([
  Object.freeze({ id: "spring-gully", name: "Spring gully", x: 34, z: 14 }),
  Object.freeze({ id: "long-spur", name: "Long spur", x: 22, z: 10 }),
  Object.freeze({ id: "north-run", name: "North run", x: 8, z: 30 }),
  Object.freeze({ id: "south-draw", name: "South draw", x: -16, z: -42 }),
  Object.freeze({ id: "basin-door", name: "Basin door run", x: -11, z: 5 }),
]);
export function traceReach(
  source,
  { step = 0.7, budget = 260, pull = 0.2 } = {},
) {
  const points = [
    { x: source.x, z: source.z, y: heightAt(source.x, source.z) },
  ];
  const seen = new Set();
  let status = "open";
  for (let i = 0; i < budget; i++) {
    const last = points.at(-1);
    let best = null;
    for (let j = 0; j < 16; j++) {
      const angle = (j * Math.PI) / 8,
        x = last.x + Math.cos(angle) * step,
        z = last.z + Math.sin(angle) * step,
        y = heightAt(x, z);
      // Descent leads; the basin term breaks the shallow dents on the far rim.
      const score = y + pull * basinDistance(x, z);
      if (!best || score < best.score) best = { x, y, z, score };
    }
    const key = `${Math.round(best.x / 0.35)},${Math.round(best.z / 0.35)}`;
    if (seen.has(key)) {
      status = "looped";
      break;
    }
    seen.add(key);
    if (
      best.y >= last.y &&
      basinDistance(best.x, best.z) >= basinDistance(last.x, last.z)
    ) {
      status = "stuck";
      break;
    }
    points.push({ x: best.x, y: best.y, z: best.z });
    if (best.y < WATER_LINE) {
      status = "water";
      break;
    }
  }
  let along = 0;
  points.forEach((p, i) => {
    if (i) along += Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z);
    p.along = along;
  });
  return { points, length: along, status, reachesWater: status === "water" };
}
function stamp(id, name, points, extra = {}) {
  let along = 0;
  const stamped = points.map((p, i) => {
    if (i) along += Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z);
    return Object.freeze({ x: p.x, y: p.y, z: p.z, along });
  });
  return Object.freeze({
    id,
    name,
    points: Object.freeze(stamped),
    length: along,
    mouth: stamped.at(-1),
    head: stamped[0],
    ...extra,
  });
}
// Nearest point on a route, with the distance and the arc length along it.
function nearestOnReach(reach, x, z) {
  let best = null;
  for (let i = 1; i < reach.points.length; i++) {
    const a = reach.points[i - 1],
      b = reach.points[i],
      dx = b.x - a.x,
      dz = b.z - a.z,
      span = dx * dx + dz * dz;
    const t = span
      ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / span))
      : 0;
    const distance = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
    if (!best || distance < best.distance)
      best = { distance, along: a.along + (b.along - a.along) * t };
  }
  return (
    best ?? {
      distance: Math.hypot(x - reach.head.x, z - reach.head.z),
      along: 0,
    }
  );
}
const distanceToPolyline = (reach, x, z) =>
  nearestOnReach(reach, x, z).distance;

const built = REACH_SOURCES.map((source) => {
  const traced = traceReach(source);
  return traced.reachesWater
    ? stamp(source.id, source.name, traced.points, { cut: false })
    : null;
}).concat(
  stamp("drainage-groove", "Drainage groove", CHANNEL_ROUTE, { cut: true }),
);
// Routes that merge, or that run beside each other for a stretch, are what make a
// basin read as a network instead of a list of gullies. Measured, not asserted:
// anything closer than 6 m is reported with its real separation.
export const NEAR_REACH_RADIUS = 6;
export const CONFLUENCE_RADIUS = 1.5;
export const REACHES = Object.freeze(
  built.filter(Boolean).map((reach) => {
    let near = null;
    for (const other of built.filter(Boolean)) {
      if (other.id === reach.id) continue;
      for (const p of reach.points) {
        const distance = distanceToPolyline(other, p.x, p.z);
        if (!near || distance < near.distance)
          near = { id: other.id, name: other.name, distance };
      }
    }
    if (!near || near.distance > NEAR_REACH_RADIUS) return reach;
    return Object.freeze({
      ...reach,
      near: Object.freeze({
        id: near.id,
        name: near.name,
        distance: near.distance,
        joins: near.distance < CONFLUENCE_RADIUS,
      }),
    });
  }),
);
export const LONGEST_REACH = REACHES[0];
// The watershed's spring gets a place in the world: the head of its longest route.
export const SPRING_SITE = Object.freeze({
  x: LONGEST_REACH.head.x,
  z: LONGEST_REACH.head.z,
});
export const reachById = (id) => REACHES.find((r) => r.id === id) ?? null;
export function reachAt(x, z, radius = REACH_RADIUS) {
  let best = null;
  for (const reach of REACHES) {
    const near = nearestOnReach(reach, x, z);
    if (!best || near.distance < best.near.distance) best = { reach, near };
  }
  if (!best || best.near.distance > radius) return null;
  return {
    id: best.reach.id,
    name: best.reach.name,
    cut: !!best.reach.cut,
    distance: best.near.distance,
    toMouth: Math.max(0, best.reach.length - best.near.along),
    toHead: best.near.along,
    near: best.reach.near ?? null,
  };
}
