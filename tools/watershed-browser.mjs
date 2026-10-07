import { launchBrowser } from "./browser-launch.mjs";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { WATER_BASE, waterLevelFor } from "../src/simulation/water-level.js";
import { waterAt } from "../src/player/movement-region.js";

const shoreline = (level) => {
  let wet = 0;
  for (let x = -12; x <= 12; x += 1)
    for (let z = -33; z <= 33; z += 1) if (waterAt(x, z, level)) wet++;
  return wet;
};

const browser = await launchBrowser();
const evidence = {};
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__SF?.loop.frames.length > 10);

  evidence.retiredSense = await page.evaluate(() => ({
    inputHasSense: Object.hasOwn(window.__SF.input.sample(), "sense"),
    touchSense: !!document.querySelector('[data-action="sense"]'),
    helpMentionsSense: /Current Sense|amber ripple|X = Sense/.test(
      document.querySelector("#help")?.textContent || "",
    ),
  }));
  assert.deepEqual(evidence.retiredSense, {
    inputHasSense: false,
    touchSense: false,
    helpMentionsSense: false,
  });

  // Fixture positioning isolates the causal watershed proof. The physical interaction
  // itself still uses the same Space/Water Jet input available to the player.
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
    g.rig.yaw = Math.PI;
    g.rig.pitch = 0;
    g.rig.initial = true;
  });
  await page.waitForFunction(() => window.__SF.stats().effects.obstruction === 9);
  evidence.obstructionBefore = await page.evaluate(
    () => window.__SF.stats().effects.obstruction,
  );
  evidence.levelUntouched = await page.evaluate(
    () => window.__SF.state.waterLevel,
  );
  assert.ok(evidence.levelUntouched <= WATER_BASE + 1e-9);
  await page.screenshot({ path: "artifacts/watershed-obstruction-before.png" });

  await page.keyboard.down("Space");
  await page.waitForFunction(() => window.__SF.body.hoseActive === true);
  await page.waitForFunction(
    () =>
      window.__SF.jetHit.serial > 0 &&
      window.__SF.jetHit.kind === "debris" &&
      window.__SF.stats().performance.effects.jetImpact > 0,
  );
  evidence.jetHit = await page.evaluate(() => ({
    serial: window.__SF.jetHit.serial,
    kind: window.__SF.jetHit.kind,
    particles: window.__SF.stats().performance.effects.jetImpact,
    debrisPulse: window.__SF.stats().effects.obstruction,
  }));
  await page.waitForFunction(
    () => window.__SF.state.watershed.nodes[1].blockage < 0.94,
  );
  await page.keyboard.up("Space");
  await page.waitForFunction(() => window.__SF.body.jetTime === 0);
  evidence.blockageBeforeClear = await page.evaluate(
    () => window.__SF.state.watershed.nodes[1].blockage,
  );

  const aimAtDebris = async () => {
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
      g.rig.yaw = Math.PI;
      g.rig.pitch = 0;
      g.rig.initial = true;
    });
    await page.waitForTimeout(120);
  };

  await page.keyboard.down("Space");
  await page.waitForFunction(() => window.__SF.body.hoseActive === true);
  let cleared = false;
  for (let attempt = 0; attempt < 90 && !cleared; attempt++) {
    await aimAtDebris();
    cleared =
      (await page.evaluate(
        () => window.__SF.state.watershed.nodes[1].blockage,
      )) < 1e-6;
  }
  await page.keyboard.up("Space");
  await page.waitForFunction(() => window.__SF.body.hoseActive === false, null, {
    timeout: 15000,
  });
  evidence.blockageCleared = await page.evaluate(
    () => window.__SF.state.watershed.nodes[1].blockage,
  );
  assert.ok(cleared, `aimed hosing left blockage ${evidence.blockageCleared}`);
  await page.waitForFunction(() => window.__SF.stats().effects.obstruction === 0);
  evidence.obstructionAfter = await page.evaluate(
    () => window.__SF.stats().effects.obstruction,
  );
  assert.equal(evidence.obstructionAfter, 0);

  const before = evidence.levelUntouched;
  await page.waitForFunction(
    (base) => window.__SF.state.waterLevel > base + 0.18,
    WATER_BASE,
    { timeout: 120000 },
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
    "background hydrology must visibly move the same shoreline the body uses",
  );
  await page.screenshot({ path: "artifacts/watershed-background-after.png" });

  const levelPair = () =>
    page.evaluate(() => {
      const wetland = window.__SF.state.watershed.nodes.find(
        (n) => n.id === "wetland",
      );
      return { level: window.__SF.state.waterLevel, wetness: wetland.wetness };
    });
  await page.click("#settings-toggle");
  await page.click("#save");
  await page.reload();
  await page.waitForFunction(() => window.__SF?.loop.frames.length > 5);
  const afterRestore = await levelPair();
  evidence.levelAfterReload = afterRestore.level;
  assert.equal(
    afterRestore.level,
    waterLevelFor(afterRestore.wetness),
    "save/load must reconstruct water level from authoritative watershed state",
  );
  assert.equal(
    await page.evaluate(() => window.__SF.state.watershed.nodes[1].blockage),
    evidence.blockageCleared,
  );

  evidence.levelFollowsGraph = await page.evaluate(() => {
    const wetland = window.__SF.state.watershed.nodes.find(
      (n) => n.id === "wetland",
    );
    const was = wetland.wetness;
    wetland.wetness = 0.5;
    const raised = window.__SF.state.waterLevel;
    wetland.wetness = was;
    const back = window.__SF.state.waterLevel;
    return { raised, back, was };
  });
  assert.equal(evidence.levelFollowsGraph.raised, waterLevelFor(0.5));
  assert.equal(evidence.levelFollowsGraph.back, evidence.levelAfterReload);
  assert.deepEqual(errors, []);

  await writeFile(
    "docs/qa/watershed-browser.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(
    "Background watershed causality passed without Current Sense: physical obstruction, input-driven interaction, shoreline response and save/reload remained truthful.",
  );
} finally {
  await browser.close();
}
