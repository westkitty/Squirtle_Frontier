import test from "node:test";
import assert from "node:assert/strict";
import {
  GAMEPAD_DEADZONE,
  radialDeadzone,
  standardGamepadState,
  touchStickState,
} from "../src/input.js";

const buttons = () =>
  Array.from({ length: 12 }, () => ({ pressed: false, value: 0 }));

test("radial deadzone removes drift but preserves full analog range", () => {
  assert.deepEqual(radialDeadzone(0.05, -0.04), { x: 0, y: 0 });
  const mid = radialDeadzone(GAMEPAD_DEADZONE + 0.2, 0);
  assert.ok(mid.x > 0 && mid.x < 1);
  assert.equal(radialDeadzone(2, 0).x, 1);
});

test("standard gamepad mapping covers movement, look and creature actions", () => {
  const b = buttons();
  b[0] = { pressed: true, value: 1 };
  b[4] = { pressed: true, value: 1 };
  b[7] = { pressed: false, value: 0.8 };
  b[11] = { pressed: true, value: 1 };
  const state = standardGamepadState({
    connected: true,
    id: "Test Pad",
    axes: [0.6, -0.7, 0.5, -0.4],
    buttons: b,
  });
  assert.equal(state.connected, true);
  assert.equal(state.name, "Test Pad");
  assert.ok(state.move.x > 0 && state.move.z > 0);
  assert.ok(state.look.x > 0 && state.look.y < 0);
  assert.equal(state.jet, true);
  assert.equal("sense" in state, false);
  assert.equal(state.dive, true);
  assert.equal(state.run, true);
  assert.equal(state.recenter, true);
  assert.equal(state.slide, false);
});

test("touch stick deadzone and travel scale with the actual control size", () => {
  const small = { left: 0, top: 0, width: 100, height: 100 },
    large = { left: 0, top: 0, width: 160, height: 160 };
  const center = touchStickState(small, 52, 50);
  assert.deepEqual({ x: center.x, z: center.z }, { x: 0, z: 0 });
  const smallFull = touchStickState(small, 100, 50),
    largeFull = touchStickState(large, 160, 80);
  assert.ok(smallFull.x > 0.99 && largeFull.x > 0.99);
  assert.ok(
    Math.abs(largeFull.dx) > Math.abs(smallFull.dx),
    "larger controls should allow proportionally larger knob travel",
  );
});
