import { LANDMARKS } from "./simulation/place-memory.js";
import { reachById } from "./simulation/reaches.js";

const mapCoord = (value) => Math.max(2, Math.min(143, value + 70));
const cellCoord = (value) => Math.max(0, Math.min(140, (value + 14) * 5));

export function surveyedCells(memory) {
  return Object.entries(memory?.cells || {}).map(([key, visits]) => {
    const [x, z] = key.split(",").map(Number),
      count = Math.max(1, Math.min(255, Number(visits) || 1)),
      intensity = Math.min(1, Math.log2(count + 1) / 5);
    return {
      key,
      x: cellCoord(x),
      y: cellCoord(z),
      visits: count,
      opacity: 0.32 + intensity * 0.6,
    };
  });
}

export function drinkTrackMarkers(memory) {
  return Object.entries(memory?.drinks || {}).map(([key, observations]) => {
    const [x, z] = key.split(",").map(Number),
      count = Math.max(1, Math.min(255, Number(observations) || 1)),
      intensity = Math.min(1, Math.log2(count + 1) / 5);
    return {
      key,
      x: cellCoord(x) + 2.5,
      y: cellCoord(z) + 2.5,
      observations: count,
      radius: 1.2 + intensity * 1.25,
      opacity: 0.45 + intensity * 0.5,
    };
  });
}

export function rememberedLandmarkMarkers(memory) {
  return (memory?.places || [])
    .map((id) => LANDMARKS.find((landmark) => landmark.id === id))
    .filter(Boolean)
    .map((landmark) => ({
      id: landmark.id,
      name: landmark.name,
      x: mapCoord(landmark.x),
      y: mapCoord(landmark.z),
    }));
}

export function followedReachTraces(memory, maxPoints = 56) {
  return (memory?.reaches || [])
    .map((id) => reachById(id))
    .filter(Boolean)
    .map((reach) => {
      const step = Math.max(1, Math.ceil(reach.points.length / maxPoints)),
        sampled = reach.points.filter(
          (_, index) => index % step === 0 || index === reach.points.length - 1,
        );
      const points = sampled.map((point) => ({
        x: mapCoord(point.x),
        y: mapCoord(point.z),
      }));
      return {
        id: reach.id,
        name: reach.name,
        points,
        mouth: points.at(-1),
      };
    });
}
