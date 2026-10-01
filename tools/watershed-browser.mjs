import { launchBrowser } from "./browser-launch.mjs";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { REACHES } from "../src/simulation/reaches.js";
import { WATER_BASE } from "../src/simulation/water-level.js";
import { waterAt } from "../src/player/movement-region.js";
// Counted here rather than in the page, through the same predicate the body swims by.
const shoreline = (level) => {
  let wet = 0;
  for (let x = -12; x <= 12; x += 1)
    for (let z = -33; z <= 33; z += 1) if (waterAt(x, z, level)) wet++;
  return wet;
};

// A point mid-route on the north run: the inflow whose wording this pass is about,
// because it is the one the basin can flood without the player cutting anything.
const WATCH_POINT = REACHES.find((r) => r.id === "north-run").points[7];
const browser = await launchBrowser();
const evidence = {};
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
  const nudged = await page.evaluate(
    () => window.__SF.state.watershed.nodes[1].blockage,
  );
  // Two poses: a place to stand on the route, and the debris shore the jet needs. The
  // body drifts with the current and slides down slopes, so the jet loop re-finds its
  // footing between pulses instead of trusting one placement to hold.
  const place = async (x, z, y, mode, grounded) => {
    await page.evaluate(
      ([x, z, y, mode, grounded]) => {
        const g = window.__SF,
          height = y === null ? g.state.sampleHeight(x, z) : y;
        Object.assign(g.body, {
          x,
          z,
          y: height,
          vx: 0,
          vy: 0,
          vz: 0,
          yaw: Math.PI,
          mode,
          grounded,
        });
        g.rig.initial = true;
      },
      [x, z, y, mode, grounded],
    );
    await page.waitForTimeout(400);
  };
  const stand = (x, z) => place(x, z, null, "land", true);
  const aimAtDebris = () => place(-6, 14, -0.22, "swim", false);
  const sense = async () => {
    // The status line keeps the last message after the key is released, so clearing it is
    // what makes this read a fresh sense line rather than the previous one.
    await page.evaluate(() => {
      document.querySelector("#status").textContent = "";
    });
    await page.keyboard.down("KeyF");
    let text = "";
    for (let attempt = 0; attempt < 40; attempt++) {
      text = await page.evaluate(
        () => document.querySelector("#status").textContent,
      );
      if (text.includes("You are on the")) break;
      await page.waitForTimeout(120);
    }
    await page.keyboard.up("KeyF");
    return text;
  };

  // Setup teleport onto the route; the water itself is only moved by the jet below.
  await stand(WATCH_POINT.x, WATCH_POINT.z);
  evidence.levelUntouched = await page.evaluate(
    () => window.__SF.state.waterLevel,
  );
  assert.ok(
    evidence.levelUntouched <= WATER_BASE + 1e-9,
    "an untouched basin has to sit exactly on the line it used to",
  );
  evidence.senseBeforeFlood = await sense();
  assert.match(
    evidence.senseBeforeFlood,
    /You are on the North run, a dry channel/,
    "an inflow with nothing in it must not claim water",
  );

  // Clear the landslide outright rather than nudging it. The jet is a 0.36 s pulse on a
  // 1.1 s cooldown, so this is the same wait-a-pulse play a player does, not a shortcut.
  await page.keyboard.down("Space");
  let cleared = false;
  for (let attempt = 0; attempt < 90 && !cleared; attempt++) {
    await aimAtDebris();
    cleared =
      (await page.evaluate(
        () => window.__SF.state.watershed.nodes[1].blockage,
      )) < 1e-6;
  }
  await page.keyboard.up("Space");
  await page.waitForFunction(() => window.__SF.body.jetTime === 0, null, {
    timeout: 15000,
  });
  evidence.blockageCleared = await page.evaluate(
    () => window.__SF.state.watershed.nodes[1].blockage,
  );
  assert.ok(
    cleared,
    `aimed jetting has to clear the landslide, left ${evidence.blockageCleared}`,
  );

  await stand(WATCH_POINT.x, WATCH_POINT.z);
  await page.waitForFunction(
    (base) => window.__SF.state.waterLevel > base + 0.18,
    WATER_BASE,
    { timeout: 120000 },
  );
  await page.waitForFunction(
    (base) => window.__SF.state.waterLevel > base + 0.18,
    WATER_BASE,
    { timeout: 120000 },
  );
  evidence.blockageBeforeClear = nudged;
  const before = evidence.levelUntouched;
  evidence.senseAfterFlood = await sense();
  assert.match(
    evidence.senseAfterFlood,
    /You are on the North run, water in patches/,
    "the flooded reach has to say so, in measured rather than authored words",
  );
  evidence.waterLevel = {
    before,
    after: await page.evaluate(() => window.__SF.state.waterLevel),
  };
  assert.ok(evidence.waterLevel.after > before + 0.18);
  evidence.shorelineCells = {
    before: shoreline(before),
    after: shoreline(evidence.waterLevel.after),
  };
  assert.ok(
    evidence.shorelineCells.after > evidence.shorelineCells.before + 20,
    "a fed wetland has to uncover less shore than a blocked one",
  );
  await page.click("#settings-toggle");
  await page.click("#save");
  await page.reload();
  await page.waitForFunction(() => window.__SF?.loop.frames.length > 5);
  assert.equal(
    await page.evaluate(() => window.__SF.state.watershed.nodes[1].blockage),
    evidence.blockageCleared,
  );
  evidence.levelAfterReload = await page.evaluate(
    () => window.__SF.state.waterLevel,
  );
  assert.equal(
    evidence.levelAfterReload,
    evidence.waterLevel.after,
    "the level is derived from the graph, so a restore has to reproduce it",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "docs/qa/watershed-browser.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(
    "Current Sense, input-driven repair, the flooded north run and graph reload passed; setup position was teleported.",
  );
} finally {
  await browser.close();
}
