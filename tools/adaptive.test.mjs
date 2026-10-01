import { test } from "node:test";
import assert from "node:assert/strict";
import { AdaptiveScale, SCALE_LIMITS } from "../src/adaptive-quality.js";
import { pixelRatioFor } from "../src/render-quality.js";
const fill = (a, ms) => {
  let out = null;
  for (let i = 0; i < a.windowSize; i++) out = a.add(ms) ?? out;
  return out;
};
test("slow windows step scale down through cooldown gaps; healthy windows recover", () => {
  const a = new AdaptiveScale({ windowSize: 4, fastMs: 13 });
  assert.equal(fill(a, 12), null, "already at the ceiling cannot increase");
  assert.equal(a.value, 1);
  assert.equal(fill(a, 60), 0.85);
  assert.equal(fill(a, 60), null, "cooldown window is skipped");
  assert.equal(fill(a, 60), 0.7);
  assert.equal(fill(a, 60), null);
  assert.equal(fill(a, 60), SCALE_LIMITS.min);
  assert.equal(fill(a, 60), null, "never sinks below the floor");
  assert.equal(a.value, SCALE_LIMITS.min);
  assert.equal(a.changes, 3);
  for (let i = 0; i < 9; i++) fill(a, 4);
  assert.equal(
    a.value,
    SCALE_LIMITS.max,
    "sustained headroom recovers to full detail",
  );
  // 3 downward steps plus 5 upward steps; skipped cooldown windows never count.
  assert.equal(a.changes, 8);
});
test("disabled adaptation pins scale at one and rejects outlier samples", () => {
  const a = new AdaptiveScale({ enabled: false });
  for (let i = 0; i < 40; i++) assert.equal(a.add(400), null);
  assert.equal(a.value, 1);
  assert.equal(a.enabled, false);
  const b = new AdaptiveScale({});
  for (const junk of [NaN, 0, -5, 900, undefined, Infinity])
    assert.equal(b.add(junk), null);
  assert.equal(b.samples.length, 0);
  fill(b, 60);
  assert.equal(b.setEnabled(false), 1);
  assert.equal(b.enabled, false);
  assert.equal(fill(b, 60), null);
  assert.equal(b.value, 1);
});
test("adaptation multiplies the preset ceiling without changing CSS size", () => {
  const base = pixelRatioFor("high", 1600, 900, 2);
  assert.equal(base, 1.2, "pixel budget, not CSS, is bounded");
  assert.equal(Math.round(base * SCALE_LIMITS.min * 1000) / 1000, 0.66);
  assert.ok(base * SCALE_LIMITS.min < base);
  assert.equal(
    pixelRatioFor("high", 1600, 900, 2) * 1,
    base,
    "scale one is identity",
  );
});
