// Browser-level Gamepad API proof: synthetic standard pad drives the same
// Input class and game loop used by real keyboard/touch play.
import { launchBrowser } from "./browser-launch.mjs";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const browser = await launchBrowser(),
  evidence = { errors: [] };
try {
  const context = await browser.newContext({
    viewport: { width: 960, height: 640 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => evidence.errors.push(e.message));
  page.on(
    "console",
    (m) => m.type() === "error" && evidence.errors.push(m.text()),
  );
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 16 }, () => ({
        pressed: false,
        touched: false,
        value: 0,
      })),
      pad = {
        id: "Synthetic Standard Gamepad",
        index: 0,
        connected: true,
        mapping: "standard",
        timestamp: 1,
        axes: [0, 0, 0, 0],
        buttons,
      };
    window.__SF_TEST_GAMEPAD = pad;
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [pad],
    });
  });
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__SF?.loop.frames.length > 10, null, {
    timeout: 60000,
  });

  const startDistance = await page.evaluate(() => window.__SF.body.distance);
  await page.evaluate(() => {
    window.__SF_TEST_GAMEPAD.axes[1] = -1;
    window.__SF_TEST_GAMEPAD.timestamp++;
  });
  await page.waitForFunction(
    (d) => window.__SF.body.distance > d + 0.45,
    startDistance,
    { timeout: 30000 },
  );
  await page.evaluate(() => {
    window.__SF_TEST_GAMEPAD.axes[1] = 0;
    window.__SF_TEST_GAMEPAD.timestamp++;
  });
  evidence.move = await page.evaluate(() => ({
    modality: window.__SF.input.inputMode(),
    distance: window.__SF.body.distance,
    jetKey: document.querySelector("#jet-key").textContent,
  }));
  assert.equal(evidence.move.modality, "gamepad");
  await page.waitForFunction(
    () => document.querySelector("#jet-key").textContent === "A",
  );

  const yaw = await page.evaluate(() => window.__SF.rig.yaw);
  await page.evaluate(() => {
    window.__SF_TEST_GAMEPAD.axes[2] = 0.8;
    window.__SF_TEST_GAMEPAD.timestamp++;
  });
  await page.waitForFunction(
    (before) => Math.abs(window.__SF.rig.yaw - before) > 0.08,
    yaw,
    { timeout: 30000 },
  );
  await page.evaluate(() => {
    window.__SF_TEST_GAMEPAD.axes[2] = 0;
    window.__SF_TEST_GAMEPAD.timestamp++;
  });
  evidence.lookYawDelta = Math.abs(
    (await page.evaluate(() => window.__SF.rig.yaw)) - yaw,
  );

  await page.evaluate(() => {
    const b = window.__SF_TEST_GAMEPAD.buttons[0];
    b.pressed = true;
    b.touched = true;
    b.value = 1;
    window.__SF_TEST_GAMEPAD.timestamp++;
  });
  await page.waitForFunction(() => window.__SF.body.jetPressTime > 0, null, {
    timeout: 30000,
  });
  await page.evaluate(() => {
    const b = window.__SF_TEST_GAMEPAD.buttons[0];
    b.pressed = false;
    b.touched = false;
    b.value = 0;
    window.__SF_TEST_GAMEPAD.timestamp++;
  });
  await page.waitForFunction(() => window.__SF.body.jetCooldown > 0, null, {
    timeout: 30000,
  });
  evidence.jet = await page.evaluate(() => ({
    cooldown: window.__SF.body.jetCooldown,
    jetTime: window.__SF.body.jetTime,
  }));
  await page.waitForFunction(
    () => window.__SF.body.jetCooldown === 0 && window.__SF.body.jetTime === 0,
    null,
    { timeout: 30000 },
  );
  await page.evaluate(() => {
    const b = window.__SF_TEST_GAMEPAD.buttons[0];
    b.pressed = true;
    b.touched = true;
    b.value = 1;
    window.__SF_TEST_GAMEPAD.timestamp++;
  });
  await page.waitForFunction(() => window.__SF.body.hoseActive === true, null, {
    timeout: 30000,
  });
  evidence.hose = await page.evaluate(() => ({
    active: window.__SF.body.hoseActive,
    cooldown: window.__SF.body.jetCooldown,
    jetTime: window.__SF.body.jetTime,
  }));
  assert.equal(evidence.hose.cooldown, 0);
  assert.equal(evidence.hose.jetTime, 0);
  await page.evaluate(() => {
    const b = window.__SF_TEST_GAMEPAD.buttons[0];
    b.pressed = false;
    b.touched = false;
    b.value = 0;
    window.__SF_TEST_GAMEPAD.timestamp++;
  });
  await page.waitForFunction(() => window.__SF.body.hoseActive === false);

  await page.evaluate(() => {
    const g = window.__SF;
    g.rig.yaw = g.body.yaw + 1;
    const b = window.__SF_TEST_GAMEPAD.buttons[11];
    b.pressed = true;
    b.value = 1;
    window.__SF_TEST_GAMEPAD.timestamp++;
  });
  await page.waitForFunction(
    () => Math.abs(window.__SF.rig.yaw - window.__SF.body.yaw) < 0.05,
    null,
    { timeout: 30000 },
  );
  evidence.recenter = await page.evaluate(() => ({
    yaw: window.__SF.rig.yaw,
    bodyYaw: window.__SF.body.yaw,
  }));
  assert.deepEqual(evidence.errors, []);
  console.log(
    "Synthetic standard gamepad drove movement, look, Jet Burst, held Water Hose, modality UI and camera recenter through the live browser loop.",
  );
} finally {
  await writeFile(
    "docs/qa/gamepad-browser.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  await browser.close();
}
