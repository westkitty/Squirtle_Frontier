// One writer for the live region. Simulation time owns expiry; stale incidental
// messages are discarded, not queued to interrupt a later player request.
export const CHANNELS = Object.freeze({
  ambient: 0,
  contextual: 1,
  system: 2,
  request: 3,
});
export class StatusArbiter {
  constructor({ hold = 4, ambient = "" } = {}) {
    this.hold = hold;
    this.ambient = ambient;
    this.text = ambient;
    this.channel = CHANNELS.ambient;
    this.remaining = 0;
    this.writes = 0;
  }
  get isHeld() {
    return this.remaining > 0;
  }
  say(text, channel = CHANNELS.contextual, seconds = this.hold) {
    if (
      typeof text !== "string" ||
      !text ||
      !Number.isFinite(seconds) ||
      seconds <= 0
    )
      return false;
    if (this.isHeld && channel < this.channel) return false;
    if (text === this.text && channel === this.channel) return false;
    this.channel = channel;
    this.remaining = seconds;
    return this.set(text);
  }
  set(text) {
    if (this.text === text) return false;
    this.text = text;
    this.writes++;
    return true;
  }
  note(text) {
    this.ambient = text;
    return !this.isHeld && this.set(text);
  }
  tick(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || !this.isHeld) return false;
    this.remaining = Math.max(0, this.remaining - dt);
    if (this.isHeld) return false;
    this.channel = CHANNELS.ambient;
    return this.set(this.ambient);
  }
  snapshot() {
    return {
      text: this.text,
      channel: this.channel,
      remaining: this.remaining,
      writes: this.writes,
    };
  }
}
