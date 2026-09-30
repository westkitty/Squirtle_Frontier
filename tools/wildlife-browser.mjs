import { launchBrowser } from "./browser-launch.mjs";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await launchBrowser(),
  report = { errors: [], cycles: [] };
try {
  const p = await browser.newPage({ viewport: { width: 960, height: 640 } });
  p.on("pageerror", (e) => report.errors.push(e.message));
  await p.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await p.waitForFunction(() => window.__SF?.loop.frames.length > 10);
  // Explicit rich-habitat fixture, not a claim of player-completed ecological repair.
  await p.evaluate(() => {
    const g = window.__SF;
    g.state.ecosystem.prey = 0.9;
    g.state.ecosystem.predators = 0.7;
    Object.assign(g.body, {
      x: -7,
      z: -9,
      y: g.state.sampleHeight(-7, -9),
      vx: 0,
      vz: 0,
      vy: 0,
    });
    g.rig.initial = true;
  });
  await p.waitForFunction(() => window.__SF.wildlife.actors.length > 8);
  await p.waitForTimeout(600);
  await p.screenshot({ path: "artifacts/wildlife.png" });
  report.modes = await p.evaluate(() =>
    window.__SF.wildlife.actors.map((a) => a.mode),
  );
  assert.ok(report.modes.includes("stalk"));
  await p.evaluate(() => {
    const g = window.__SF,
      a = g.wildlife.actors.find((a) => a.kind === "prey");
    Object.assign(g.body, {
      x: a.x,
      z: a.z + 1,
      y: g.state.sampleHeight(a.x, a.z + 1),
      vx: 0,
      vy: 0,
      vz: 0,
    });
  });
  await p.waitForFunction(() =>
    window.__SF.wildlife.actors.some((a) => a.mode === "evade"),
  );
  // Set settlement history, then let real ticks allocate bowl water and display welcome.
  await p.evaluate(() => {
    const g = window.__SF;
    g.state.settlement.familiarity = 0.4;
    g.state.settlement.waterReliability = 0.8;
    g.state.ecosystem.cistern = 0.8;
    Object.assign(g.body, {
      x: -11,
      z: -8,
      y: g.state.sampleHeight(-11, -8),
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.rig.initial = true;
  });
  await p.waitForFunction(() => window.__SF.state.settlement.bowl > 0.02);
  await p.screenshot({ path: "artifacts/settlement-welcome.png" });
  const familiarity = await p.evaluate(
    () => window.__SF.state.settlement.familiarity,
  );
  await p.click("#settings-toggle");
  await p.click("#save");
  await p.reload();
  await p.waitForFunction(
    () => window.__SF?.state.settlement.familiarity >= 0.4,
  );
  report.savedFamiliarity = await p.evaluate(
    () => window.__SF.state.settlement.familiarity,
  );
  assert.ok(report.savedFamiliarity >= familiarity);
  for (let i = 0; i < 12; i++) {
    await p.evaluate(() => window.__SF.enterPlace("lab"));
    await p.waitForTimeout(100);
    assert.equal(await p.evaluate(() => window.__SF.wildlife.actors.length), 0);
    await p.evaluate(() => window.__SF.enterPlace("frontier"));
    await p.waitForFunction(() => window.__SF.streaming.stats().active === 9);
    const s = await p.evaluate(() => window.__SF.stats());
    assert.ok(s.memory.geometries <= 23);
    assert.equal(s.assets.references, 1);
    report.cycles.push(s.memory);
  }
  await p.evaluate(() => window.__SF.dispose());
  report.teardown = await p.evaluate(() => ({
    ...window.__SF.renderer.info.memory,
  }));
  assert.equal(report.teardown.geometries, 0);
  assert.equal(report.teardown.textures, 0);
  assert.deepEqual(report.errors, []);
  console.log(
    "Wildlife stalk/evade, visible settlement bowl, persisted familiarity and 12 lifecycle returns passed.",
  );
} finally {
  await writeFile(
    "docs/qa/wildlife-browser.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
