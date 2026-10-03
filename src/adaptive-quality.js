// Renderer-only pixel budget adaptation. Simulation, input and world state never read this.
export const SCALE_LIMITS = Object.freeze({ min: 0.55, max: 1 });
export class AdaptiveScale {
  constructor({
    windowSize = 60,
    slowMs = 26,
    fastMs = 13,
    cooldownWindows = 1,
    slowWindows = 2,
    fastWindows = 3,
    enabled = true,
  } = {}) {
    this.windowSize = windowSize;
    this.slowMs = slowMs;
    this.fastMs = fastMs;
    this.cooldownWindows = cooldownWindows;
    this.slowWindows = Math.max(1, slowWindows | 0);
    this.fastWindows = Math.max(1, fastWindows | 0);
    this.slowStreak = 0;
    this.fastStreak = 0;
    this.enabled = enabled !== false;
    this.value = 1;
    this.samples = [];
    this.cooldown = 0;
    this.changes = 0;
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
    const slow = median > this.slowMs;
    const fast = median < this.fastMs && p95 < this.slowMs * 1.25;
    if (slow) {
      this.slowStreak++;
      this.fastStreak = 0;
    } else if (fast) {
      this.fastStreak++;
      this.slowStreak = 0;
    } else {
      this.slowStreak = 0;
      this.fastStreak = 0;
    }
    if (this.cooldown > 0) {
      this.cooldown--;
      return null;
    }
    let next = this.value;
    if (slow && this.slowStreak >= this.slowWindows) {
      next -= 0.15;
      this.slowStreak = 0;
    } else if (fast && this.fastStreak >= this.fastWindows) {
      next += 0.1;
      this.fastStreak = 0;
    }
    next = Math.min(
      SCALE_LIMITS.max,
      Math.max(SCALE_LIMITS.min, Math.round(next * 100) / 100),
    );
    if (next === this.value) return null;
    this.value = next;
    this.cooldown = this.cooldownWindows;
    this.changes++;
    return next;
  }
  setEnabled(enabled) {
    this.enabled = enabled !== false;
    this.samples.length = 0;
    this.cooldown = 0;
    this.slowStreak = 0;
    this.fastStreak = 0;
    const next = this.enabled ? this.value : 1;
    this.value = next;
    return next;
  }
  snapshot() {
    return { value: this.value, enabled: this.enabled, changes: this.changes };
  }
}
