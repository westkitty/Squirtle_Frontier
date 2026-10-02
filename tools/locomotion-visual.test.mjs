// Locomotion Zero, stage 6: a resize that does not flash, and a water surface the
// camera state cannot cross by accident.
//
// Both halves are measured as numbers: frame-to-frame deltas for the fog blend (a
// strobe is a large delta on a frame where the player did nothing), and reallocation
// counts for the resize pump (a flash is an unnecessary reallocation).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WaterView,
  WATER_VIEW,
  mixHex,
} from "../src/player/water-view-state.js";
import { createResizePump } from "../src/render-resize.js";
import { AdaptiveScale, SCALE_LIMITS } from "../src/adaptive-quality.js";
import { Loop, MAX_FRAME_DT } from "../src/loop.js";

const fill = (a, ms, times = 1) => {
  let out = null;
  for (let i = 0; i < times; i++)
    for (let j = 0; j < a.windowSize; j++) out = a.add(ms) ?? out;
  return out;
};

test("bobbing at the surface never crosses the camera's water state", () => {
  const view = new WaterView();
  let flips = 0,
    previous = view.underwater;
  // A swim bob: the eye rides a few centimetres above and below the plane at 2 Hz.
  for (let i = 0; i < 600; i++) {
    const t = i / 60,
      signed = 0.05 * Math.sin(t * Math.PI * 2 * 2);
    const out = view.update(1 / 60, signed, true);
    if (out.underwater !== previous) flips++;
    previous = out.underwater;
    assert.ok(
      out.mix < 0.02,
      `a bob at the line pushed the blend to ${out.mix.toFixed(3)}`,
    );
  }
  assert.equal(flips, 0, "every crossing of the plane was a strobe");
  // A deliberate dive still reads as a dive.
  const dived = view.update(1 / 60, -0.4, true);
  assert.equal(dived.underwater, true);
  // And climbing back to just above the line is *not* enough to leave it: that is the
  // band, not a lag.
  assert.equal(view.update(1 / 60, 0.05, true).underwater, true);
  assert.equal(
    view.update(1 / 60, WATER_VIEW.exitAbove + 0.01, true).underwater,
    false,
  );
});

test("the blend eases instead of cutting, then settles exactly", () => {
  const view = new WaterView();
  let maxDelta = 0,
    previous = 0,
    steps = 0;
  for (let i = 0; i < 120; i++) {
    const out = view.update(1 / 60, -0.6, true);
    maxDelta = Math.max(maxDelta, Math.abs(out.mix - previous));
    previous = out.mix;
    if (out.mix < 0.999) steps++;
  }
  assert.ok(
    maxDelta < 0.35,
    `the fog moved ${maxDelta.toFixed(3)} of the way in one frame`,
  );
  assert.ok(steps > 4, "a dive has to be visible, not instantaneous");
  assert.equal(previous, 1, "and it has to arrive, not hang half-done");
  // Density is continuous with the blend, and both directions converge.
  view.update(1 / 60, WATER_VIEW.exitAbove + 1, true);
  for (let i = 0; i < 120; i++)
    view.update(1 / 60, WATER_VIEW.exitAbove + 1, true);
  const out = view.update(1 / 60, WATER_VIEW.exitAbove + 1, true);
  assert.ok(Math.abs(out.density - WATER_VIEW.densityAbove) < 1e-9);
  assert.equal(out.mix, 0);
  const deep = new WaterView();
  for (let i = 0; i < 120; i++) deep.update(1 / 60, -3, true);
  assert.ok(
    Math.abs(deep.update(1 / 60, -3, true).density - WATER_VIEW.densityBelow) <
      1e-9,
    "submerged density must reach the target and stop there",
  );
});

test("no water here means no underwater state, at any depth", () => {
  const view = new WaterView();
  for (let i = 0; i < 10; i++)
    assert.equal(view.update(1 / 60, -5, false).underwater, false);
  view.update(1 / 60, -5, true); // submerged in water
  assert.equal(view.underwater, true);
  // The floor drops out / the pond drains: the state and the blend release.
  for (let i = 0; i < 120; i++) view.update(1 / 60, -5, false);
  assert.equal(view.mix, 0, "fog has to clear when the water is gone");
  assert.equal(view.update(1 / 60, Number.NaN, false).underwater, false);
  // A place change must not inherit the last place's blend.
  view.update(1 / 60, -0.6, true);
  view.reset();
  assert.deepEqual(view.snapshot(), { underwater: false, mix: 0 });
});

test("the colour is a blend of the two looks, and the maths is bounded", () => {
  assert.equal(mixHex(0x000000, 0xffffff, 0), 0x000000);
  assert.equal(mixHex(0x000000, 0xffffff, 1), 0xffffff);
  assert.equal(mixHex(0x000000, 0xffffff, 0.5), 0x808080);
  assert.equal(mixHex(0x123456, 0xabcdef, -2), 0x123456, "t is clamped");
  assert.equal(mixHex(0x123456, 0xabcdef, 9), 0xabcdef);
  const view = new WaterView();
  const above = view.update(1 / 60, 1, true, 0x9bb9aa);
  assert.equal(above.color, 0x9bb9aa, "above water is exactly the sky colour");
  for (let i = 0; i < 400; i++) view.update(1 / 60, -1, true, 0x9bb9aa);
  assert.equal(
    view.update(1 / 60, -1, true, 0x9bb9aa).color,
    0x246c69,
    "under water is exactly the shaft colour",
  );
});

test("resize requests coalesce into at most one reallocation per frame", () => {
  const calls = [];
  let size = { width: 1280, height: 720, pixelRatio: 1 };
  const pump = createResizePump({
    renderer: {
      setPixelRatio: (r) => calls.push(["ratio", r]),
      setSize: (w, h, updateStyle) => calls.push(["size", w, h, updateStyle]),
    },
    measure: () => size,
  });
  for (let i = 0; i < 40; i++) pump.request();
  assert.equal(calls.length, 0, "a request must never reallocate on its own");
  assert.equal(pump.flush(), true);
  assert.equal(
    calls.length,
    2,
    `${calls.length} calls for one coalesced resize`,
  );
  assert.deepEqual(calls[1], ["size", 1280, 720, false]);
  assert.equal(
    calls[1][3],
    false,
    "the canvas keeps its CSS box; inline pixel sizes fight 100dvh",
  );
  // Nothing changed: nothing is touched. This is what makes a spurious request free.
  pump.request();
  assert.equal(
    pump.flush(),
    false,
    "an unchanged measurement must not realloc",
  );
  assert.equal(calls.length, 2);
  // A pixel budget change reallocates once, on the next flush.
  size = { width: 1280, height: 720, pixelRatio: 0.85 };
  pump.request();
  pump.request();
  assert.equal(pump.flush(), true);
  assert.equal(calls.length, 4);
  assert.ok(pump.size.includes("0.850"), pump.size);
  // Fractional viewports round: the same physical box cannot thrash between 1280.4
  // and 1280.6 pixels forever.
  const rounded = createResizePump({
    renderer: { setPixelRatio: () => {}, setSize: () => {} },
    measure: () => ({ width: 1280.4, height: 720.2, pixelRatio: 1 }),
  });
  rounded.request();
  assert.equal(rounded.flush(), true);
  rounded.request();
  assert.equal(rounded.flush(), false, "sub-pixel drift is not a resize");
  size = { width: Number.NaN, height: 720, pixelRatio: 1 };
  pump.request();
  assert.equal(pump.flush(), false, "a broken measurement is refused");
});

test("the scale controller refuses to hum around its own thresholds", () => {
  // Borderline frames alternating just over and just under the slow edge: a naive
  // controller steps down, then recovers, then steps down again - each change being a
  // reallocation, which is the flash this stage exists to remove.
  const a = new AdaptiveScale({ windowSize: 4, slowMs: 26, fastMs: 13 });
  for (let i = 0; i < 40; i++)
    for (let j = 0; j < a.windowSize; j++) a.add(i % 2 === 0 ? 27 : 25);
  assert.equal(a.changes, 0, `a borderline signal caused ${a.changes} changes`);
  assert.equal(
    a.value,
    1,
    "a median brushing the raw threshold buys no reallocation",
  );
  // Load that is not in doubt is acted on once and then held: down, and not back up on
  // a merely-better window.
  const hum = new AdaptiveScale({ windowSize: 4 });
  for (let i = 0; i < 12; i++)
    for (let j = 0; j < hum.windowSize; j++) hum.add(i % 2 === 0 ? 60 : 20);
  assert.ok(hum.value < 1, "clear load has to reduce detail");
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < hum.windowSize; j++) hum.add(20);
  assert.equal(hum.value, hum.value, "and 20ms windows must not buy recovery");
  assert.ok(hum.changes <= 3, `${hum.changes} changes across 20 windows`);
  // Sustained load still walks all the way down, and sustained headroom all the way up.
  const b = new AdaptiveScale({ windowSize: 4 });
  for (let i = 0; i < 12; i++) fill(b, 60);
  assert.equal(b.value, SCALE_LIMITS.min, "a heavy world still loses detail");
  for (let i = 0; i < 24; i++) fill(b, 4);
  assert.equal(b.value, SCALE_LIMITS.max, "and a light one gets it back");
  // Rearming after a reallocation throws the measured window away and ignores the next
  // one, so the cost of the change is never read as the reason for another change.
  const c = new AdaptiveScale({ windowSize: 4 });
  fill(c, 60);
  assert.equal(c.value, 0.85);
  c.rearm();
  fill(c, 60);
  assert.equal(c.value, 0.85, "the window spent on the resize was counted");
  fill(c, 60);
  assert.equal(c.value, 0.85, "and the change's own cooldown defers one more");
  fill(c, 60);
  assert.equal(c.value, 0.7, "then measurement resumes normally");
  // Sub-threshold changes are not reported at all, so nothing requests a resize.
  const d = new AdaptiveScale({ windowSize: 4 });
  assert.equal(fill(d, 20), null, "20ms is not slow enough to act on");
  assert.equal(d.value, 1);
});

test("a frame the loop truncated is not evidence about load", () => {
  let steps = 0;
  const loop = new Loop(
    () => {
      steps++;
    },
    () => {},
  );
  loop.frame(0);
  loop.frame(1000 / 60);
  assert.equal(loop.lastFrameDiscarded, false);
  loop.frame(1000 / 60 + MAX_FRAME_DT * 1000 + 400);
  assert.equal(
    loop.lastFrameDiscarded,
    true,
    "a tab restore must be recognisable",
  );
  assert.ok(loop.stats().discarded > 0.24);
  loop.frame(1000 / 60 + MAX_FRAME_DT * 1000 + 400 + 1000 / 60);
  assert.equal(
    loop.lastFrameDiscarded,
    false,
    "and must not poison the next frame",
  );
  assert.ok(steps > 0);
});
