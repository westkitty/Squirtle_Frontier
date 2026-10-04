import { LANDMARKS } from "./simulation/place-memory.js";
import { reachById } from "./simulation/reaches.js";

const mapCoord = (value) => Math.max(2, Math.min(143, value + 70));

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
      return {
        id: reach.id,
        name: reach.name,
        points: sampled.map((point) => ({
          x: mapCoord(point.x),
          y: mapCoord(point.z),
        })),
      };
    });
}
