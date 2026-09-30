import { launchBrowser } from "./browser-launch.mjs";
import assert from "node:assert/strict";
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__SF?.loop.frames.length > 10);
  // Explicit setup teleport; subsequent repair uses actual input and simulation.
  await page.evaluate(() => {
    const g = window.__SF;
    Object.assign(g.body, {
      x: -6,
      z: 14,
      y: -0.22,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: Math.PI,
      mode: "swim",
      grounded: false,
    });
    g.rig.initial = true;
  });
  await page.keyboard.down("KeyF");
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("sediment"),
  );
  await page.screenshot({ path: "artifacts/watershed-sense.png" });
  await page.keyboard.up("KeyF");
  await page.keyboard.down("Space");
  await page.waitForFunction(
    () => window.__SF.state.watershed.nodes[1].blockage < 0.94,
  );
  await page.keyboard.up("Space");
  await page.waitForFunction(() => window.__SF.body.jetTime === 0);
  const blockage = await page.evaluate(
    () => window.__SF.state.watershed.nodes[1].blockage,
  );
  await page.click("#settings-toggle");
  await page.click("#save");
  await page.reload();
  await page.waitForFunction(() => window.__SF?.loop.frames.length > 5);
  assert.equal(
    await page.evaluate(() => window.__SF.state.watershed.nodes[1].blockage),
    blockage,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Current Sense, input-driven repair and graph reload passed; setup position was teleported.",
  );
} finally {
  await browser.close();
}
