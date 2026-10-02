// The camera's read of the water surface, as a state that resists flicker.
//
// The underwater look used to be a per-frame boolean: `camera.position.y < level &&
// region.water(...)`, and the result snapped fog colour and density on the spot. That
// test crosses the line constantly in ordinary play — a swimming body bobs a few
// centimetres, the camera lags behind it over a shoreline, and a steep look angle
// pushes the eye through the surface plane in a single step. Each crossing swapped the
// whole atmosphere for a frame or two: a strobe at the waterline, most visible exactly
// where the game wants to look calm.
//
// Two mechanisms fix it, and both are measurable without a renderer:
//
//   hysteresis   — entering needs to be a little under, leaving needs to be a little
//                  over, so a body bobbing at the line stays on one side of the state.
//   easing       — the blend chases the state instead of jumping to it, so a real
//                  dive is a visible transition rather than a cut.
//
// No THREE here on purpose: presentation reads the numbers, and a test can hold the
// same module.
export const WATER_VIEW = Object.freeze({
  // The band has to be wider than the swim itself: a floating body rides a spring
  // that moves the eye a few centimetres, and a threshold tighter than that turn
  // ordinary breathing into a strobe.
  enterBelow: 0.06, // signed depth past which the eye counts as submerged
  exitAbove: 0.18, // and signed height past which it counts as clear
  rate: 5.5, // blend follow speed, per second
  densityAbove: 0.025,
  densityBelow: 0.13,
  densityRain: 0.015,
});

const ABOVE = 0xffffff;

function channel(hex, shift) {
  return (hex >> shift) & 0xff;
}

// Blend two packed colours by `t`. Kept integer-bounded so `setHex` never sees a
// fractional channel and so the result is stable under repeated easing.
export function mixHex(from, to, t) {
  const k = Math.min(1, Math.max(0, t)),
    lerp = (shift) =>
      Math.round(
        channel(from, shift) + (channel(to, shift) - channel(from, shift)) * k,
      );
  return (lerp(16) << 16) | (lerp(8) << 8) | lerp(0);
}

export class WaterView {
  constructor(rules = WATER_VIEW) {
    this.rules = rules;
    this.underwater = false;
    this.mix = 0;
    this.depth = 0;
  }
  // A place change (or a save restore) must not inherit the blend of the last place.
  reset() {
    this.underwater = false;
    this.mix = 0;
    this.depth = 0;
  }
  // `signed` is eye height above the water plane (negative means under); `wet` is the
  // world saying there is water here at all. Returns the frame's fog numbers.
  update(dt, signed, wet, aboveColor = ABOVE, rain = 0) {
    const rules = this.rules,
      depth = Number.isFinite(signed) ? signed : 0;
    this.depth = depth;
    const usable = wet && Number.isFinite(signed);
    if (usable) {
      if (this.underwater) {
        if (depth > rules.exitAbove) this.underwater = false;
      } else if (depth < -rules.enterBelow) this.underwater = true;
    } else if (this.underwater) this.underwater = false;
    const target = this.underwater ? 1 : 0,
      // Rate-limited rather than proportional-only: a real dive should feel like
      // going under, not like a fade filter, so the blend moves fast but never in one
      // frame while the state itself is allowed no shorter than two frames.
      follow = 1 - Math.exp(-rules.rate * Math.max(0, Math.min(0.1, dt)));
    this.mix += (target - this.mix) * follow;
    if (Math.abs(target - this.mix) < 0.002) this.mix = target;
    const above =
      rain > 0 ? mixHex(aboveColor, 0x6f8b86, Math.min(1, rain)) : aboveColor;
    return {
      underwater: this.underwater,
      mix: this.mix,
      color: mixHex(above, 0x246c69, this.mix),
      density:
        rules.densityAbove +
        rain * rules.densityRain +
        (rules.densityBelow - rules.densityAbove - rain * rules.densityRain) *
          this.mix,
    };
  }
  snapshot() {
    return {
      underwater: this.underwater,
      mix: Math.round(this.mix * 1000) / 1000,
    };
  }
}
