// LF's single renderer-owned loop, with bounded fixed steps for simulation.
export class Loop {
  constructor(update, render) { this.update = update; this.render = render; this.accumulator = 0; this.last = null; this.frames = []; }
  frame(now) {
    const raw = this.last === null ? 0 : Math.max(0, (now - this.last) / 1000);
    this.last = now;
    this.accumulator += Math.min(raw, 0.1);
    while (this.accumulator >= 1 / 60) { this.update(1 / 60); this.accumulator -= 1 / 60; }
    this.render();
    if (raw > 0) { this.frames.push(raw * 1000); if (this.frames.length > 600) this.frames.shift(); }
  }
  reset() { this.last = null; this.accumulator = 0; }
}
