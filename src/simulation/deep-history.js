import { hash2i } from "../rng.js";
// Seeded aggregate eras, inspired by LF's bounded history: never centuries of actors.
export function deepHistory(seed) {
  const events = [
    "A river shifted east, leaving pale silt in a silent channel.",
    "A water house drew from the spring. Cut stone remembers its cistern.",
    "A long dry season lowered the reeds. Wind laid sand over the mud.",
    "Floodwater crossed the old bank. Seeds settled in a new wetland.",
  ];
  return Array.from({ length: 8 }, (_, i) => ({
    id: i,
    depth: 1.5 + i * 2.3,
    yearsAgo: 80 + i * 160 + Math.floor(hash2i(i, 21, seed) * 70),
    event: events[Math.floor(hash2i(i, 4, seed) * events.length)],
    material: Math.floor(hash2i(i, 8, seed) * 4),
  }));
}
