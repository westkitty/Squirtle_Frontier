import { hash2i, clamp } from "../rng.js";
import { heightAt } from "../worldgen.js";
export const FIRE_SIDE = 4;
export const fireSite = (i) => ({
  x: 12 + (i % 4) * 2,
  z: -8 + Math.floor(i / 4) * 2,
});
export const BYPASS_SITE = Object.freeze({ x: -10, z: 10 });
export function weatherAt(tick, seed) {
  const block = Math.floor(tick / 180),
    roll = hash2i(block, 17, seed);
  const type =
    roll < 0.45
      ? "clear"
      : roll < 0.7
        ? "cloudy"
        : roll < 0.92
          ? "rain"
          : "storm";
  return {
    type,
    rain: type === "rain" ? 0.65 : type === "storm" ? 1 : 0,
    wind: 0.3 + hash2i(block, 23, seed) * 0.6,
  };
}
// Descending local route derived from terrain, bounded at generation (not erosion physics).
export function traceChannel(start = BYPASS_SITE) {
  const points = [{ ...start, y: heightAt(start.x, start.z) }];
  for (let i = 0; i < 32; i++) {
    const last = points.at(-1);
    let next = last;
    for (let j = 0; j < 16; j++) {
      const angle = (j * Math.PI) / 8,
        x = last.x + Math.cos(angle) * 0.55,
        z = last.z + Math.sin(angle) * 0.55,
        y = heightAt(x, z);
      if (y < next.y - 0.001) next = { x, y, z };
    }
    if (next === last) break;
    points.push(next);
    if (next.y < -0.5) break;
  }
  return points;
}
export class FrontierSystems {
  constructor(seed = 1337, tick = 0) {
    this.seed = seed;
    this.tick = tick;
    this.bypass = 0;
    this.channelErosion = 0;
    this.heat = Array(16).fill(0);
    this.fuel = Array(16).fill(1);
    this.ash = Array(16).fill(0);
    this.soaked = Array(16).fill(0);
    this.history = [];
  }
  get weather() {
    return weatherAt(this.tick, this.seed);
  }
  get diversion() {
    return this.bypass * 0.45;
  }
  get stage() {
    return this.bypass === 0
      ? 0
      : this.channelErosion < 0.3
        ? 1
        : this.channelErosion < 3
          ? 2
          : this.channelErosion < 10
            ? 3
            : 4;
  }
  advance() {
    this.tick++;
    const w = this.weather,
      next = [...this.heat];
    for (let i = 0; i < 16; i++) {
      const neighbors = [
        i % 4 ? i - 1 : -1,
        i % 4 < 3 ? i + 1 : -1,
        i >= 4 ? i - 4 : -1,
        i < 12 ? i + 4 : -1,
      ].filter((n) => n >= 0);
      const spread =
        neighbors.reduce((sum, n) => sum + this.heat[n], 0) *
        0.03 *
        (1 - w.rain);
      const ignition =
        w.type === "storm" &&
        this.tick % 180 === 1 &&
        i === Math.floor(hash2i(this.tick, 3, this.seed) * 16) &&
        this.fuel[i] > 0.5
          ? 0.6
          : 0;
      next[i] = clamp(
        this.heat[i] +
          spread +
          ignition +
          this.heat[i] * 0.035 * this.fuel[i] -
          w.rain * 0.035 -
          this.soaked[i] * 0.12 -
          (this.fuel[i] < 0.1 ? 0.15 : 0.006),
        0,
        1,
      );
      const burned = Math.min(this.fuel[i], next[i] * 0.006);
      this.fuel[i] = clamp(
        this.fuel[i] - burned + (next[i] < 0.01 ? 0.00008 : 0),
        0,
        1,
      );
      this.ash[i] = clamp(
        this.ash[i] + burned - w.rain * this.ash[i] * 0.008,
        0,
        1,
      );
      this.soaked[i] = clamp(this.soaked[i] * 0.985 + w.rain * 0.01, 0, 1);
    }
    this.heat = next;
    this.channelErosion = Math.min(
      120,
      this.channelErosion + this.diversion * 0.025,
    );
    return {
      diversion: this.diversion,
      sourceContamination:
        (this.ash.reduce((a, b) => a + b, 0) / 16) * w.rain * 0.8,
      sourceScale: 0.8 + w.rain * 0.2,
    };
  }
  record(watershed, ecosystem) {
    if (this.tick % 300) return;
    this.history.push({
      tick: this.tick,
      flow: watershed.nodes[2].flow,
      reeds: ecosystem.reeds,
      fire: this.heat.reduce((a, b) => a + b, 0) / 16,
    });
    if (this.history.length > 90) this.history.shift();
  }
  snapshot() {
    return {
      tick: this.tick,
      bypass: this.bypass,
      channelErosion: this.channelErosion,
      heat: [...this.heat],
      fuel: [...this.fuel],
      ash: [...this.ash],
      soaked: [...this.soaked],
      history: this.history.map((x) => ({ ...x })),
    };
  }
  static restore(s, seed) {
    if (!s || !Number.isSafeInteger(s.tick) || s.tick < 0)
      throw new Error("Invalid regional tick");
    const r = new FrontierSystems(seed, s.tick);
    for (const [key, max] of [
      ["bypass", 1],
      ["channelErosion", 120],
    ]) {
      if (!Number.isFinite(s[key]) || s[key] < 0 || s[key] > max)
        throw new Error("Invalid channel state");
      r[key] = s[key];
    }
    for (const key of ["heat", "fuel", "ash", "soaked"]) {
      if (
        !Array.isArray(s[key]) ||
        s[key].length !== 16 ||
        s[key].some((v) => !Number.isFinite(v) || v < 0 || v > 1)
      )
        throw new Error("Invalid fire field");
      r[key] = [...s[key]];
    }
    if (!Array.isArray(s.history) || s.history.length > 90)
      throw new Error("Invalid history");
    let previous = -1;
    r.history = s.history.map((h) => {
      if (
        !Number.isSafeInteger(h.tick) ||
        h.tick <= previous ||
        h.tick > s.tick ||
        ["flow", "reeds", "fire"].some(
          (k) => !Number.isFinite(h[k]) || h[k] < 0 || h[k] > 1,
        )
      )
        throw new Error("Invalid history sample");
      previous = h.tick;
      return { tick: h.tick, flow: h.flow, reeds: h.reeds, fire: h.fire };
    });
    return r;
  }
}
