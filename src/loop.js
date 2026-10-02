// LF's single renderer-owned loop: a 60 Hz authoritative fixed step whose real
// elapsed time is never quietly thrown away.
//
// The old rule clamped each frame's elapsed time to 100 ms, so a 150 ms hitch
// silently deleted 50 ms of simulation: Squirtle covered less world while the
// renderer stalled, and the amount lost depended on how unlucky the frame was.
// Two bounds now do different jobs, and only one of them may drop time:
//
//   MAX_FRAME_DT  — a stall long enough to be a tab restore rather than a hitch.
//                   Time beyond it is dropped, and *counted* in `discarded`.
//   MAX_STEPS     — the spiral-of-death guard. Simulation work per frame stays
//                   bounded; the unapplied remainder is retained instead of lost,
//                   so the next frame simply catches up.
//
// The retained remainder is also what makes presentation smooth: `alpha` reports
// how far the renderer sits between the last two authoritative states, and the
// render pose interpolates by it rather than showing snapped simulation states.
export const FIXED_DT = 1 / 60;
export const MAX_FRAME_DT = 0.25;
export const MAX_STEPS = 12;
// Debt beyond this can never be repaid without a hitch the player would feel, so
// it is dropped deliberately and visibly rather than accumulated forever.
export const MAX_ACCUMULATOR = 0.5;

export class Loop {
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.accumulator = 0;
    this.last = null;
    this.frames = [];
    // Observable accounting, so "we never lose simulation time" is a measurement
    // rather than an assertion.
    this.simTime = 0;
    this.realTime = 0;
    this.steps = 0;
    this.lastSteps = 0;
    this.discarded = 0;
    this.drops = 0;
    this.alpha = 0;
    this.lastFrameDiscarded = false;
  }
  frame(now) {
    const raw = this.last === null ? 0 : Math.max(0, (now - this.last) / 1000);
    this.last = now;
    if (raw > 0) {
      this.realTime += raw;
      this.frames.push(raw * 1000);
      if (this.frames.length > 600) this.frames.shift();
    }
    // A stall this long is not a hitch to ride out; it is the tab coming back.
    const elapsed = Math.min(raw, MAX_FRAME_DT);
    // Whether *this* frame threw time away, so anything that measures frame cost can
    // decline to treat a tab restore as a load spike and react to it.
    this.lastFrameDiscarded = raw - elapsed > 1e-9;
    if (this.lastFrameDiscarded) {
      this.discarded += raw - elapsed;
      this.drops++;
    }
    this.accumulator += elapsed;
    // The count is known before the first step, so the simulation can spread
    // per-frame input across its steps instead of applying it once and idling.
    const count = Math.min(MAX_STEPS, Math.floor(this.accumulator / FIXED_DT));
    for (let step = 0; step < count; step++) {
      this.update(FIXED_DT, step, count);
      this.accumulator -= FIXED_DT;
      this.simTime += FIXED_DT;
    }
    this.steps += count;
    this.lastSteps = count;
    // Retain a repayable remainder; drop only debt that could never be repaid.
    if (this.accumulator > MAX_ACCUMULATOR) {
      this.discarded += this.accumulator - MAX_ACCUMULATOR;
      this.drops++;
      this.accumulator = MAX_ACCUMULATOR;
    }
    this.alpha = Math.min(1, this.accumulator / FIXED_DT);
    this.render();
  }
  reset() {
    this.last = null;
    this.lastFrameDiscarded = false;
    this.accumulator = 0;
    this.alpha = 0;
  }
  stats() {
    return {
      simTime: this.simTime,
      realTime: this.realTime,
      steps: this.steps,
      discarded: this.discarded,
      drops: this.drops,
      alpha: this.alpha,
    };
  }
}
