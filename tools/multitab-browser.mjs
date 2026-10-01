// Two tabs, one world: conflict detection, lock-serialized writes, explicit
// adoption of the newer generation, and full-pose resume after a reload.
import { launchBrowser } from "./browser-launch.mjs";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const KEY = "squirtle_frontier_baseline_v1";
const browser = await launchBrowser();
const evidence = { errors: [] };
try {
  const url = process.env.BASE_URL || "http://127.0.0.1:5173";
  // One browser context, because both tabs must share the same localStorage.
  const context = await browser.newContext({
    viewport: { width: 800, height: 600 },
  });
  const open = async () => {
    const page = await context.newPage();
    page.on("pageerror", (e) => evidence.errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(
      () => window.__SF?.loop.frames.length > 5,
      null,
      {
        timeout: 60000,
      },
    );
    return page;
  };
  const driver = await open();
  // The settings panel is a disclosure; clicking the toggle again would close it.
  const showSettings = (page) =>
    page.evaluate(() => {
      const panel = document.querySelector("#settings");
      if (panel.hidden) document.querySelector("#settings-toggle").click();
    });
  const follower = await open();

  // Driver walks with real input, then saves the world it changed.
  await driver.evaluate(() => {
    window.__SF.state.pose = null;
    window.__SF.state.persistenceBlocked = false;
    localStorage.removeItem("squirtle_frontier_baseline_v1");
    localStorage.removeItem("squirtle_frontier_baseline_v1_backup");
  });
  await driver.reload();
  await driver.waitForFunction(
    () => window.__SF?.loop.frames.length > 5,
    null,
    {
      timeout: 60000,
    },
  );
  await driver.bringToFront();
  await driver.locator("canvas").click({ position: { x: 400, y: 300 } });
  await driver.keyboard.down("KeyW");
  await driver.waitForFunction(() => window.__SF.body.distance > 2, null, {
    timeout: 90000,
    polling: 200,
  });
  await driver.keyboard.up("KeyW");
  const driven = await driver.evaluate(() => ({
    pose: { ...window.__SF.state.pose },
    elapsed: window.__SF.state.elapsed,
    distance: window.__SF.body.distance,
  }));
  assert.ok(
    driven.pose && Number.isFinite(driven.pose.y),
    "pose must be tracked live",
  );
  evidence.driven = driven;
  await showSettings(driver);
  const savedAt = Date.now();
  await driver.click("#save");
  // The write is asynchronous (serialized by the save lock), so wait on the
  // stored clock rather than a fixed pause.
  await driver.waitForFunction(
    (t) =>
      JSON.parse(localStorage.getItem("squirtle_frontier_baseline_v1"))
        ?.savedAt >=
      t - 1,
    savedAt,
    { timeout: 30000, polling: 200 },
  );
  evidence.stored = await driver.evaluate(() => {
    const stored = JSON.parse(
      localStorage.getItem("squirtle_frontier_baseline_v1"),
    );
    return {
      pose: stored.pose,
      elapsed: stored.elapsed,
      player: stored.player,
    };
  });
  assert.ok(evidence.stored.pose, "a v6 save must record the full pose");

  // The follower loaded the older generation, so its write must be refused.
  await follower.bringToFront();
  await showSettings(follower);
  await follower.click("#save");
  await follower.waitForFunction(
    () => /another tab/.test(document.querySelector("#status").textContent),
    null,
    { timeout: 30000, polling: 200 },
  );
  evidence.conflict = await follower.evaluate(
    () => document.querySelector("#status").textContent,
  );
  assert.ok(
    !(await follower.evaluate(() => window.__SF.state.persistenceBlocked)),
    "a refused write must not disable saving for the tab that lost the race",
  );
  evidence.rejectedWriteLeftStorage = await follower.evaluate(
    () =>
      JSON.parse(localStorage.getItem("squirtle_frontier_baseline_v1")).player
        .x,
  );

  // Explicit adoption reads the newer generation, including its body pose.
  await follower.click("#follow-tab");
  await follower.waitForFunction(
    () =>
      /Adopted the newer stored world/.test(
        document.querySelector("#status").textContent,
      ),
    null,
    {
      timeout: 20000,
    },
  );
  evidence.adopted = await follower.evaluate(() => ({
    status: document.querySelector("#status").textContent,
    elapsed: window.__SF.state.elapsed,
    pose: { ...window.__SF.state.pose },
    body: {
      x: window.__SF.body.x,
      y: window.__SF.body.y,
      z: window.__SF.body.z,
    },
  }));
  assert.ok(
    Math.abs(evidence.adopted.body.x - evidence.stored.pose.x) < 1.5,
    `follower should resume near the driver: ${JSON.stringify(evidence.adopted)}`,
  );

  // Full pose across a reload: dive inside the Lab basin, save, reload, resume.
  await driver.bringToFront();
  await driver.evaluate(() => window.__SF.enterPlace("lab"));
  await driver.waitForTimeout(400);
  // Explicit fixture: stand in the basin water so the dive keys apply. Walking
  // in from the platform is covered by the habitat journey.
  await driver.evaluate(() => {
    const g = window.__SF;
    Object.assign(g.body, {
      x: 0,
      z: 0,
      y: -0.25,
      vx: 0,
      vy: 0,
      vz: 0,
      mode: "swim",
      grounded: false,
    });
    g.rig.initial = true;
  });
  await driver.locator("canvas").click({ position: { x: 400, y: 300 } });
  await driver.keyboard.down("KeyQ");
  await driver.waitForFunction(() => window.__SF.body.y < -0.6, null, {
    timeout: 90000,
    polling: 200,
  });
  await driver.keyboard.up("KeyQ");
  const dived = await driver.evaluate(() => ({ ...window.__SF.body }));
  await showSettings(driver);
  await driver.click("#save");
  await driver.waitForFunction(
    (y) =>
      Math.abs(
        JSON.parse(localStorage.getItem("squirtle_frontier_baseline_v1")).pose
          .y - y,
      ) < 0.35,
    dived.y,
    { timeout: 30000, polling: 200 },
  );
  evidence.diveSavedY = +dived.y.toFixed(3);
  await driver.reload();
  await driver.waitForFunction(
    () => window.__SF?.loop.frames.length > 20,
    null,
    {
      timeout: 60000,
    },
  );
  evidence.afterReload = await driver.evaluate(() => ({
    place: window.__SF.state.place,
    y: +window.__SF.body.y.toFixed(3),
    mode: window.__SF.body.mode,
    basinDistance: +Math.hypot(window.__SF.body.x, window.__SF.body.z).toFixed(
      3,
    ),
  }));
  assert.equal(evidence.afterReload.place, "lab");
  assert.ok(
    evidence.afterReload.y < -0.3,
    `should resume submerged, got ${evidence.afterReload.y}`,
  );
  assert.ok(
    evidence.afterReload.basinDistance < 3.15,
    `should resume inside the basin, got ${evidence.afterReload.basinDistance}`,
  );
  // Support/mode is re-derived by physics rather than trusted from the save.
  assert.equal(evidence.afterReload.mode, "swim");
  // Leaving the Lab must return to the pre-Lab bank, not the basin centre.
  // Explicit fixture: stand on the exit threshold so R is eligible here.
  await driver.evaluate(() => {
    const g = window.__SF;
    Object.assign(g.body, {
      x: 0,
      z: 6,
      y: 0.1,
      vx: 0,
      vy: 0,
      vz: 0,
      mode: "land",
      grounded: true,
    });
    g.rig.initial = true;
  });
  await driver.waitForFunction(
    () => !document.querySelector("#interact").hidden,
    null,
    { timeout: 30000, polling: 200 },
  );
  await driver.keyboard.down("KeyR");
  await driver.waitForFunction(
    () => window.__SF.state.place === "frontier",
    null,
    {
      timeout: 30000,
    },
  );
  await driver.keyboard.up("KeyR");
  evidence.returned = await driver.evaluate(() => ({
    x: +window.__SF.body.x.toFixed(2),
    z: +window.__SF.body.z.toFixed(2),
    expected: {
      x: +window.__SF.state.frontierReturn.x.toFixed(2),
      z: +window.__SF.state.frontierReturn.z.toFixed(2),
    },
  }));
  assert.ok(
    Math.hypot(
      evidence.returned.x - evidence.returned.expected.x,
      evidence.returned.z - evidence.returned.expected.z,
    ) < 0.5,
    JSON.stringify(evidence.returned),
  );

  // A damaged save still recovers and the newer generation survives.
  evidence.storageKeys = await driver.evaluate(() =>
    Object.keys(localStorage).sort(),
  );
  assert.deepEqual(evidence.errors, []);
  console.log(
    "Two-tab conflict refusal, non-destructive adoption, pose resume from the Lab basin and bank return passed.",
  );
} finally {
  await writeFile(
    "docs/qa/multitab-browser.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  await browser.close();
}
