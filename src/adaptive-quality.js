// Renderer-only pixel budget adaptation. Simulation, input and world state never read this.
export const SCALE_LIMITS = Object.freeze({ min: 0.55, max: 1 });
// A quality controller that changes its mind every window is worse than one that is a
// frame behind: each change reallocates the framebuffer, and a reallocating frame is
// itself slow, which reads as load. The margins below mean a value has to be *clearly*
// on the other side of a threshold to cross back, and `graceWindows` lets a window be
// thrown away after a change so the cost of the change is never measured as its reason.
export const SCALE_HYSTERESIS = Object.freeze({
  down: 1.15, // median must exceed slowMs * this to step down after stepping up
  up: 0.8, // median must fall under fastMs * this to step up after stepping down
  upP95: 1.1, // and the tail must be tighter than slowMs * this, not just the median
  graceWindows: 1,
});
export class AdaptiveScale {
  constructor({
    windowSize = 60,
    slowMs = 26,
    fastMs = 13,
    cooldownWindows = 1,
    hysteresis = SCALE_HYSTERESIS,
    enabled = true,
  } = {}) {
    this.windowSize = windowSize;
    this.slowMs = slowMs;
    this.fastMs = fastMs;
    this.cooldownWindows = cooldownWindows;
    this.hysteresis = hysteresis;
    this.enabled = enabled !== false;
    this.value = 1;
    this.samples = [];
    this.cooldown = 0;
    this.grace = 0;
    this.direction = 0;
    this.changes = 0;
  }
  // Throw away what has been measured and ignore the next window. Call this after
  // anything that made the renderer do extra work for a frame - a reallocation, a
  // preset change, a place transition - so that cost is not read as the world being
  // heavy and answered with another reallocation.
  rearm() {
    this.samples.length = 0;
    this.grace = this.hysteresis.graceWindows;
  }
  // One raw wall-clock frame interval in ms. Returns the new scale on a change, else null.
  add(ms) {
    if (!this.enabled || !Number.isFinite(ms) || ms <= 0 || ms > 500)
      return null;
    this.samples.push(ms);
    if (this.samples.length < this.windowSize) return null;
    const sorted = this.samples.slice().sort((a, b) => a - b),
      median = sorted[Math.floor(sorted.length / 2)],
      p95 = sorted[Math.floor(sorted.length * 0.95)];
    this.samples.length = 0;
    if (this.grace > 0) {
      this.grace--;
      return null;
    }
    if (this.cooldown > 0) {
      this.cooldown--;
      return null;
    }
    const rules = this.hysteresis,
      slowEdge = this.slowMs * (this.direction < 0 ? 1 : rules.down),
      fastEdge = this.fastMs * (this.direction > 0 ? 1 : rules.up);
    let next = this.value;
    if (median > slowEdge) next -= 0.15;
    else if (median < fastEdge && p95 < this.slowMs * rules.upP95) next += 0.1;
    next = Math.min(
      SCALE_LIMITS.max,
      Math.max(SCALE_LIMITS.min, Math.round(next * 100) / 100),
    );
    if (next === this.value) return null;
    this.direction = next < this.value ? -1 : 1;
    this.value = next;
    this.cooldown = this.cooldownWindows;
    this.changes++;
    return next;
  }
  setEnabled(enabled) {
    this.enabled = enabled !== false;
    this.samples.length = 0;
    this.cooldown = 0;
    this.grace = 0;
    this.direction = 0;
    const next = this.enabled ? this.value : 1;
    this.value = next;
    return next;
  }
  snapshot() {
    return { value: this.value, enabled: this.enabled, changes: this.changes };
  }
}
