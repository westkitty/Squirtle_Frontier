import { launchBrowser } from "./browser-launch.mjs";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await launchBrowser();
const evidence = { errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  page.on("pageerror", (e) => evidence.errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__SF?.loop.frames.length > 5);
  await page.click("#settings-toggle");
  await page.click("#save");
  const exported = page.waitForEvent("download");
  await page.click("#export-save");
  assert.equal(
    (await exported).suggestedFilename(),
    "squirtle-frontier-save.json",
  );
  page.on("dialog", (d) => d.accept());
  await page.locator("#import-save").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("JSON"),
  );
  const before = await page.evaluate(() =>
    localStorage.getItem("squirtle_frontier_baseline_v1"),
  );
  const replacement = JSON.parse(before);
  replacement.player = { x: -9, z: 18 };
  // Version 6 resumes from the recorded pose, so an imported generation must
  // carry a matching one or the body would reappear at the old depth.
  replacement.pose = {
    x: -9,
    y: replacement.pose?.y ?? 1,
    z: 18,
    yaw: replacement.pose?.yaw ?? Math.PI,
    place: "frontier",
  };
  await page.locator("#import-save").setInputFiles({
    name: "world.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(replacement)),
  });
  await page.waitForFunction(
    () =>
      window.__SF &&
      window.__SF.state.player.x === -9 &&
      Math.abs(window.__SF.body.x + 9) < 0.5,
    null,
    { timeout: 30000, polling: 200 },
  );
  evidence.resumedFromPose = await page.evaluate(() => ({
    player: { ...window.__SF.state.player },
    pose: { ...window.__SF.state.pose },
    body: {
      x: +window.__SF.body.x.toFixed(3),
      y: +window.__SF.body.y.toFixed(3),
    },
  }));
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("squirtle_frontier_baseline_v1_quarantine"),
    ),
    before,
  );
  // Corrupt primary externally, suppress old session autosave, reload then explicitly recover.
  await page.evaluate(() => {
    const key = "squirtle_frontier_baseline_v1";
    window.__SF.state.persistenceBlocked = true;
    localStorage.setItem(key + "_backup", localStorage.getItem(key));
    localStorage.setItem(key, "broken");
  });
  await page.reload();
  await page.waitForFunction(() => window.__SF?.state.persistenceBlocked);
  await page.click("#settings-toggle");
  await page.click("#recover-save");
  await page.waitForFunction(
    () => window.__SF && !window.__SF.state.persistenceBlocked,
  );
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("squirtle_frontier_baseline_v1_quarantine"),
    ),
    "broken",
  );
  assert.deepEqual(evidence.errors, []);
  console.log(
    "Export, malformed import rejection, pose-aware confirmed import/quarantine and explicit backup recovery passed.",
  );
} finally {
  await writeFile(
    "docs/qa/recovery-browser.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  await browser.close();
}
