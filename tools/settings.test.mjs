import { test } from "node:test";
import assert from "node:assert/strict";
import { HINT_KEYS, Settings } from "../src/settings.js";
import { AdaptiveScale } from "../src/adaptive-quality.js";
import { pixelRatioFor } from "../src/render-quality.js";
const store = (raw) => {
  const values = new Map([["squirtle_frontier_settings_v1", raw]]);
  globalThis.localStorage = {
    getItem: (k) => (values.has(k) ? values.get(k) : null),
    setItem: (k, v) => values.set(k, v),
  };
  return values;
};
test("preferences survive their own key and ignore world-save damage", () => {
  const values = store(
    JSON.stringify({
      quality: "low",
      sensitivity: 1.6,
      adaptive: false,
      reducedMotion: true,
    }),
  );
  assert.deepEqual(
    {
      quality: Settings.load().quality,
      sensitivity: Settings.values.sensitivity,
      adaptive: Settings.values.adaptive,
      reducedMotion: Settings.values.reducedMotion,
    },
    { quality: "low", sensitivity: 1.6, adaptive: false, reducedMotion: true },
  );
  assert.ok(
    values.get("squirtle_frontier_settings_v1").includes('"adaptive":false'),
  );
});
test("corrupt, missing and out-of-range preference values fall back safely", () => {
  for (const raw of ["{broken", "[]", "null", '"text"', ""]) {
    store(raw);
    const v = Settings.load();
    assert.equal(v.quality, "high");
    assert.equal(v.sensitivity, 1);
    assert.equal(v.volume, 0.7);
    assert.equal(v.adaptive, true);
    assert.equal(v.reducedMotion, null, "absent means follow the system");
  }
  store(
    JSON.stringify({
      quality: "ultra",
      sensitivity: 99,
      volume: -3,
      adaptive: "yes",
      reducedMotion: "sometimes",
    }),
  );
  const v = Settings.load();
  assert.equal(v.quality, "high");
  assert.equal(v.sensitivity, 2);
  assert.equal(v.volume, 0, "a negative slider clamps to silence");
  assert.equal(
    v.adaptive,
    true,
    "only an explicit false disables adaptation, so a corrupt string cannot cost detail",
  );
  assert.equal(
    v.reducedMotion,
    null,
    "a non-tri-state value returns to following the system",
  );
  assert.equal(Settings.motionReduced, false, "no OS preference in node");
  store(JSON.stringify({ reducedMotion: true }));
  assert.equal(Settings.load().reducedMotion, true);
  assert.equal(
    Settings.motionReduced,
    true,
    "an explicit choice wins over the system",
  );
});
test("render presets bound pixels, and adaptation can only reduce them further", () => {
  for (const quality of ["high", "medium", "low"]) {
    const full = pixelRatioFor(quality, 1920, 1080, 3),
      adapted = full * new AdaptiveScale({}).value;
    assert.ok(full > 0 && Math.ceil(1920 * 1080 * adapted * adapted) >= 0);
    assert.equal(adapted, full, "a fresh adaptive scale is identity");
    assert.ok(full <= 1.5);
  }
  const small = pixelRatioFor("low", 390, 844, 3);
  assert.ok(small * 0.55 < small);
  assert.equal(
    Math.round(pixelRatioFor("high", 3840, 2160, 2) * 1000) / 1000,
    Math.round(Math.sqrt(2073600 / (3840 * 2160)) * 1000) / 1000,
    "the pixel ceiling wins over the device ratio on large displays",
  );
});

test("guidance preference keeps only supported one-shot hint receipts", () => {
  store(
    JSON.stringify({
      hints: false,
      seenHints: { swim: true, gamepad: true, obsolete: true },
    }),
  );
  const v = Settings.load();
  assert.equal(v.hints, false);
  assert.deepEqual(v.seenHints, { swim: true, gamepad: true });
  assert.deepEqual(HINT_KEYS, ["swim", "sense", "record", "gamepad"]);
});
