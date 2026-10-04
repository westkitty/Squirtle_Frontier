import { launchBrowser } from "./browser-launch.mjs";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const browser = await launchBrowser(),
  report = { errors: [], ecotypes: [], modes: {}, persistence: null, hydrology: null, shucker: null };
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  page.on("pageerror", (error) => report.errors.push(error.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__SF?.loop.frames.length > 10);

  // Habitat fixture only: it uses the real watershed/ecology state and merely starts the
  // observer beside valid habitat. It does not teleport an actor or fabricate a species.
  await page.evaluate(() => {
    const g = window.__SF;
    g.state.watershed.nodes[0].flow = 1;
    g.state.watershed.nodes[0].wetness = 1;
    g.state.watershed.nodes[1].restoration = 1;
    g.state.watershed.nodes[2].wetness = 0.9;
    g.state.watershed.nodes[2].contamination = 0;
    g.state.watershed.nodes[2].sediment = 0;
    g.state.ecosystem.reeds = 0.9;
    g.state.ecosystem.cistern = 0.9;
    g.state.settlement.waterReliability = 0.9;
    g.state.settlement.familiarity = 0.35;
    g.state.settlement.fear = 0;
    for (let i = 0; i < 500; i++)
      g.state.squirtleEcology.tick(g.state.watershed, g.state.ecosystem, g.state.settlement);
    g.state.squirtleEcology.abundance.marsh = 1;
    g.state.squirtleEcology.abundance.urban = 1;
    g.state.squirtleEcology.bumpRevision();
    Object.assign(g.body, {
      x: -9,
      z: -12,
      y: g.state.sampleHeight(-9, -12),
      vx: 0,
      vy: 0,
      vz: 0,
      jetTime: 0,
      mode: "land",
      grounded: true,
    });
    g.rig.initial = true;
  });
  await page.waitForFunction(
    () => window.__SF.squirtles.activeCount >= 2 && window.__SF.squirtleView.performanceStats().active >= 2,
    null,
    { timeout: 30000 },
  );
  report.ecotypes = await page.evaluate(() =>
    [...new Set(window.__SF.squirtles.actors.filter((actor) => actor.active).map((actor) => actor.ecotype))],
  );
  assert.ok(report.ecotypes.includes("marsh"));
  assert.ok(report.ecotypes.includes("urban"));
  assert.ok((await page.evaluate(() => window.__SF.squirtles.activeCount)) <= 3);
  await page.screenshot({ path: "artifacts/squirtle-social.png" });

  // Calm Urban proximity should not read like Freshwater/Marsh panic.
  await page.evaluate(() => {
    const g = window.__SF,
      urban = g.squirtles.actors.find((actor) => actor.active && actor.ecotype === "urban");
    urban.trust = 0.75;
    Object.assign(g.body, { x: urban.x, z: urban.z + 2.1, vx: 0, vz: 0, jetTime: 0, mode: "land" });
  });
  await page.waitForTimeout(900);
  report.modes.calmUrban = await page.evaluate(() =>
    window.__SF.squirtles.actors.find((actor) => actor.active && actor.ecotype === "urban")?.mode,
  );
  assert.ok(["watch", "rest", "socialize", "forage"].includes(report.modes.calmUrban));

  // A close Water Jet is an actual alarm input; Marsh prefers cover or flight.
  await page.evaluate(() => {
    const g = window.__SF,
      marsh = g.squirtles.actors.find((actor) => actor.active && actor.ecotype === "marsh");
    Object.assign(g.body, { x: marsh.x, z: marsh.z + 2.2, vx: 0, vz: 0, jetTime: 0.7, mode: "land" });
  });
  await page.waitForFunction(() => {
    const marsh = window.__SF.squirtles.actors.find((actor) => actor.active && actor.ecotype === "marsh");
    return marsh && ["hide", "flee"].includes(marsh.mode);
  });
  report.modes.alarmedMarsh = await page.evaluate(() =>
    window.__SF.squirtles.actors.find((actor) => actor.active && actor.ecotype === "marsh")?.mode,
  );

  // Let real local movement leave a bounded same-species trace, then ask Current Sense.
  await page.waitForFunction(() => window.__SF.squirtles.traces.length > 0, null, { timeout: 10000 });
  const trace = await page.evaluate(() => window.__SF.squirtles.traces.find(Boolean));
  await page.evaluate(({ x, z }) => {
    const g = window.__SF;
    Object.assign(g.body, { x, z: z + 1, y: g.state.sampleHeight(x, z + 1), vx: 0, vz: 0, jetTime: 0, mode: "land" });
  }, trace);
  await page.keyboard.down("f");
  await page.waitForFunction(() => /tracks|shell|Squirtle|water/i.test(document.querySelector("#status")?.textContent || ""));
  report.sense = await page.evaluate(() => document.querySelector("#status")?.textContent || "");
  await page.keyboard.up("f");

  // Sustained calm contact is meaningful enough to promote one deterministic individual.
  await page.evaluate(() => {
    const g = window.__SF,
      urban = g.squirtles.actors.find((actor) => actor.active && actor.ecotype === "urban");
    Object.assign(g.body, { x: urban.x, z: urban.z + 2.1, vx: 0, vz: 0, jetTime: 0, mode: "land" });
  });
  await page.waitForFunction(() => window.__SF.state.memory.squirtles.length > 0, null, { timeout: 20000 });
  const remembered = await page.evaluate(() => window.__SF.state.memory.squirtles[0]);
  await page.click("#settings-toggle");
  await page.click("#save");
  await page.reload();
  await page.waitForFunction(() => window.__SF?.state.memory.squirtles.length > 0);
  report.persistence = await page.evaluate((id) => ({
    version: window.__SF.state.version,
    record: window.__SF.state.memory.squirtles.find((entry) => entry.id === id) || null,
  }), remembered.id);
  assert.equal(report.persistence.version, 7);
  assert.equal(report.persistence.record?.id, remembered.id);

  // Existing watershed change alters Squirtle ecology through the same one-second tick.
  report.hydrology = await page.evaluate(() => {
    const g = window.__SF;
    g.state.watershed.nodes[1].blockage = 0.95;
    g.state.watershed.nodes[1].restoration = 0;
    g.state.watershed.nodes[2].wetness = 0.02;
    g.state.ecosystem.reeds = 0.02;
    for (let i = 0; i < 180; i++) g.state.update(1);
    const before = g.state.squirtleEcology.suitability.marsh;
    for (let i = 0; i < 12; i++) g.state.watershed.clearDebris("landslide", 0.1);
    for (let i = 0; i < 360; i++) g.state.update(1);
    const after = g.state.squirtleEcology.suitability.marsh;
    return { before, after };
  });
  assert.ok(report.hydrology.after > report.hydrology.before);

  // Illegal does not mean universally hostile.
  const legal = await page.evaluate(() => {
    const s = window.__SF.state.settlement;
    s.fear = 0;
    s.familiarity = 0.3;
    s.bowl = 0.2;
    return s.legalResponse;
  });
  assert.ok(["feed", "tolerate", "protect", "watch", "ignore"].includes(legal));
  assert.notEqual(legal, "report");

  // Deliberately induce the rare threat for proof: it must cause a distinct hide/flee and
  // Current Sense may name it only because genuine Shucker state now exists.
  await page.evaluate(() => {
    const g = window.__SF;
    g.state.squirtleEcology.induceShuckerPressure(0.9, 90);
    const e = g.state.squirtleEcology.shuckerEvidence();
    Object.assign(g.body, { x: e.x, z: e.z + 1, y: g.state.sampleHeight(e.x, e.z + 1), vx: 0, vz: 0, jetTime: 0, mode: "land" });
  });
  await page.waitForFunction(() =>
    window.__SF.squirtles.actors.some((actor) => actor.active && ["hide", "flee", "return-home"].includes(actor.mode)),
  );
  await page.keyboard.down("f");
  await page.waitForFunction(() => /Shucker evidence/.test(document.querySelector("#status")?.textContent || ""));
  report.shucker = await page.evaluate(() => ({
    status: document.querySelector("#status")?.textContent || "",
    pressure: window.__SF.state.squirtleEcology.shuckerPressure,
    modes: window.__SF.squirtles.actors.filter((actor) => actor.active).map((actor) => actor.mode),
  }));
  await page.keyboard.up("f");
  await page.screenshot({ path: "artifacts/squirtle-shucker-warning.png" });

  await page.evaluate(() => window.__SF.dispose());
  await page.waitForFunction(() => window.__SF.assets.stats().references === 0 && window.__SF.assets.stats().cached === 0);
  report.teardown = await page.evaluate(() => ({
    memory: { ...window.__SF.renderer.info.memory },
    assets: window.__SF.assets.stats(),
  }));
  assert.equal(report.teardown.memory.geometries, 0);
  assert.equal(report.teardown.memory.textures, 0);
  assert.equal(report.teardown.assets.references, 0);
  assert.equal(report.teardown.assets.cached, 0);
  assert.deepEqual(report.errors, []);
  console.log("Squirtle ecology/social journey passed: valid ecotypes, behavior, sense, persistence, watershed causality, legality, Shucker warning and teardown.");
} finally {
  await writeFile("docs/qa/squirtle-social-browser.json", JSON.stringify(report, null, 2));
  await browser.close();
}
