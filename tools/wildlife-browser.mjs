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
  // Wetland repair decides whether the herd has somewhere to drink. The
  // clearing uses the real debris action; low predation keeps drinking visible
  // in a short window, so this is an ecological fixture, not a played repair.
  await p.evaluate(() => {
    const g = window.__SF;
    g.state.ecosystem.prey = 0.9;
    g.state.ecosystem.predators = 0.2;
    for (let i = 0; i < 40; i++)
      g.state.watershed.clearDebris("landslide", 0.1);
    // Stand on the north rim looking into the shallows: close enough to observe
    // drink tracks, high enough to see the herd.
    Object.assign(g.body, {
      x: -6,
      z: -9.5,
      y: g.state.sampleHeight(-6, -9.5),
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.rig.initial = true;
  });
  await p.waitForFunction(
    () => window.__SF.state.watershed.nodes[2].wetness > 0.4,
    null,
    { timeout: 150000, polling: 200 },
  );
  await p.waitForFunction(
    () => window.__SF.wildlife.actors.some((a) => a.mode === "drink"),
    null,
    { timeout: 150000, polling: 200 },
  );
  // Screenshot vantage only: turn to face a drinking animal from 3.5 m away so
  // the behaviour is actually in frame. Position still comes from the real world.
  await p.evaluate(() => {
    const g = window.__SF,
      a = g.wildlife.actors.find((x) => x.mode === "drink");
    if (!a) return;
    Object.assign(g.body, {
      x: a.x,
      z: a.z + 3.5,
      y: g.state.sampleHeight(a.x, a.z + 3.5),
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.body.yaw = Math.atan2(a.x - g.body.x, a.z - g.body.z);
    g.rig.initial = true;
  });
  report.drink = await p.evaluate(() => {
    const g = window.__SF,
      a = g.wildlife.actors.find((x) => x.mode === "drink");
    return {
      at: { x: +a.x.toFixed(2), z: +a.z.toFixed(2) },
      inWater: !!g.region.water(a.x, a.z),
      issue: g.wildlife.waterIssue,
      sites: g.wildlife.sites.length,
      drinkers: g.wildlife.drinkers.length,
    };
  });
  assert.equal(
    report.drink.inWater,
    true,
    "a drinker must stand where the world has water",
  );
  assert.equal(report.drink.issue, null);
  await p.click("#memory-toggle");
  await p.waitForFunction(
    () => document.querySelector("#drink-note").textContent.length > 0,
    null,
    { timeout: 10000 },
  );
  report.drinkNote = await p.evaluate(
    () => document.querySelector("#drink-note").textContent,
  );
  assert.match(report.drinkNote, /Drink tracks in \d+ places?/);
  assert.match(
    report.drinkNote,
    /nearest \d+ m [NSEW]{1,2}\./,
    "the panel must name a real bearing",
  );
  assert.doesNotMatch(report.drinkNote, /undefined/);
  await p.screenshot({ path: "artifacts/wildlife-drinking.png" });
  // Re-block the spring and the shallows dry out: drinking stops, the panel says why.
  await p.evaluate(() => {
    const g = window.__SF;
    g.state.watershed.nodes[1].blockage = 0.95;
    g.state.watershed.nodes[0].flow = 0.05;
  });
  // Wait well past the behavioural threshold (0.25) so nothing is compared
  // while a drink is finishing or a tick is still buffered.
  await p.waitForFunction(
    () =>
      window.__SF.wildlife.waterIssue === "dry" &&
      window.__SF.wildlife.drinkers.length === 0 &&
      window.__SF.state.watershed.nodes[2].wetness < 0.15,
    null,
    { timeout: 200000, polling: 200 },
  );
  // Any drink already in progress aborts on the next frame, then the count is
  // frozen: give it a beat and compare against the total at the flip.
  const tracksAtIssue = await p.evaluate(
    () =>
      window.__SF.state.memory.drinks &&
      Object.values(window.__SF.state.memory.drinks).reduce((a, b) => a + b, 0),
  );
  const samples = [];
  for (let i = 0; i < 8; i++) {
    await p.waitForTimeout(1000);
    samples.push(
      await p.evaluate(() => ({
        issue: window.__SF.wildlife.waterIssue,
        drinkers: window.__SF.wildlife.drinkers.length,
        tracks: Object.values(window.__SF.state.memory.drinks).reduce(
          (a, b) => a + b,
          0,
        ),
      })),
    );
  }
  report.drySamples = samples;
  report.dryGrowth = samples.length
    ? samples[samples.length - 1].tracks - tracksAtIssue
    : 0;
  report.dry = await p.evaluate(() => ({
    issue: window.__SF.wildlife.waterIssue,
    drinking: window.__SF.wildlife.actors.filter((a) => a.mode === "drink")
      .length,
    parched: window.__SF.wildlife.actors.filter((a) => a.mode === "parched")
      .length,
    wetness: +window.__SF.state.watershed.nodes[2].wetness.toFixed(3),
    note: document.querySelector("#drink-note").textContent,
    tracks: Object.values(window.__SF.state.memory.drinks).reduce(
      (a, b) => a + b,
      0,
    ),
  }));
  assert.equal(report.dry.drinking, 0, "nobody drinks at a dry shallow");
  assert.ok(report.dry.parched > 0, "thirsty animals should pace");
  assert.match(report.dry.note, /too dry to drink at/);
  assert.equal(
    report.dryGrowth,
    0,
    "no new drink tracks may be logged while the shallows are dry",
  );
  await p.screenshot({ path: "artifacts/wildlife-parched.png" });
  await p.click("#memory-toggle");
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

  // The Memory panel must describe the same settlement state the world shows.
  await p.click("#memory-toggle");
  // The panel must already be current on the first frame after opening.
  await p.waitForFunction(
    () => document.querySelector("#house-note").textContent.length > 0,
    null,
    { timeout: 5000 },
  );
  report.houseNote = await p.evaluate(
    () => document.querySelector("#house-note").textContent,
  );
  assert.match(report.houseNote, /caretaker leaves a filled bowl/);
  assert.match(report.houseNote, /1 visit\)/);
  await p.screenshot({ path: "artifacts/settlement-memory.png" });
  await p.click("#memory-toggle");
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
    assert.ok(s.memory.geometries <= 24);
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
    "Wildlife stalk/evade, wetland-gated drinking, dry-shallow avoidance, visible settlement bowl, persisted familiarity and 12 lifecycle returns passed.",
  );
} finally {
  await writeFile(
    "docs/qa/wildlife-browser.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
