import { launchBrowser } from "./browser-launch.mjs";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await launchBrowser(),
  report = { cycles: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__SF?.loop.frames.length > 10);
  // Explicit setup near the door; enter with actual keyboard handler.
  await page.evaluate(() => {
    const g = window.__SF;
    Object.assign(g.body, {
      x: -11,
      z: 6,
      y: g.region.sample(-11, 6).height,
      vx: 0,
      vz: 0,
    });
  });
  await page.keyboard.down("KeyR");
  await page.waitForFunction(() => window.__SF.state.place === "lab");
  await page.keyboard.up("KeyR");
  await page.screenshot({ path: "artifacts/lab-before.png" });
  // Seed a repaired save, then emulate thirty minutes absent using its wall clock.
  await page.evaluate(async () => {
    const g = window.__SF;
    for (let i = 0; i < 10; i++)
      g.state.watershed.clearDebris("landslide", 0.1);
    const { save } = await import("/src/persistence.js");
    save(g.state, localStorage, Date.now());
  });
  await page.goto("about:blank");
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__SF?.loop.frames.length > 5);
  await page.evaluate(() => {
    window.__SF.state.persistenceBlocked = true;
    const key = "squirtle_frontier_baseline_v1",
      s = JSON.parse(localStorage.getItem(key));
    s.savedAt -= 1800000;
    localStorage.setItem(key, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForFunction(() => window.__SF?.state.ecosystem.labFrogs > 0.1);
  report.return = await page.evaluate(() => ({
    place: window.__SF.state.place,
    ecosystem: window.__SF.state.ecosystem.snapshot(),
  }));
  assert.equal(report.return.place, "lab");
  await page.screenshot({ path: "artifacts/lab-after.png" });
  await page.evaluate(() => {
    const g = window.__SF;
    Object.assign(g.body, {
      x: -4.4,
      z: 5.6,
      y: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      grounded: true,
    });
  });
  await page.waitForFunction(() =>
    document.querySelector("#interact").textContent.includes("Rest"),
  );
  const beforeRest = await page.evaluate(() => window.__SF.state.elapsed);
  await page.keyboard.down("KeyR");
  await page.waitForFunction(
    (t) => window.__SF.state.elapsed >= t + 300,
    beforeRest,
  );
  // Browser key-repeat events must not turn one held press into repeated rests.
  for (let i = 0; i < 10; i++) {
    await page.keyboard.down("KeyR");
    await page.waitForTimeout(40);
  }
  await page.keyboard.up("KeyR");
  const rested = await page.evaluate(() => window.__SF.state.elapsed);
  assert.ok(
    rested < beforeRest + 305,
    "held action must not repeat fast-forward",
  );
  report.restSeconds = 300;
  await page.screenshot({ path: "artifacts/lab-rest.png" });
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => window.__SF.enterPlace("frontier"));
    await page.waitForFunction(
      () => window.__SF.streaming.stats().active === 9,
    );
    await page.evaluate(() => window.__SF.enterPlace("lab"));
    await page.waitForTimeout(150);
    const s = await page.evaluate(() => window.__SF.stats());
    assert.equal(s.chunks.active, 0);
    assert.equal(s.assets.references, 1);
    assert.ok(s.memory.geometries <= 19);
    report.cycles.push({ memory: s.memory, assets: s.assets });
  }
  await page.evaluate(() => window.__SF.dispose());
  report.teardown = await page.evaluate(() => {
    const s = window.__SF.stats();
    delete s.frames;
    return s;
  });
  assert.equal(report.teardown.memory.geometries, 0);
  assert.equal(report.teardown.memory.textures, 0);
  assert.deepEqual(report.errors, []);
  console.log(
    "Door input, offline colonization, 12 Lab/frontier cycles and zero-resource teardown passed.",
  );
} finally {
  await writeFile(
    "docs/qa/habitat-browser.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
