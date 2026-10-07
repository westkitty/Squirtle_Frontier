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

  // The Lab before anything reaches it: no reeds, no frogs, and a caretaker sentence
  // that says what the basin is waiting for. The door is entered with the real key.
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
  report.labBefore = await page.evaluate(() => {
    const lab = window.__SF.labView();
    return {
      place: window.__SF.state.place,
      labReeds: lab.reeds.count,
      labFrogs: lab.animals.count,
      basinOpacity: lab.basin.material.opacity,
      labWater: window.__SF.state.ecosystem.labWater,
    };
  });
  assert.equal(report.labBefore.labReeds, 0, "an unfed basin renders no reeds");
  assert.equal(report.labBefore.labFrogs, 0, "an unfed basin renders no frogs");
  assert.ok(
    report.labBefore.basinOpacity < 0.35,
    "an unfed basin renders thin water",
  );
  await page.screenshot({ path: "artifacts/lab-before.png" });
  // Leave through the threshold the same way a player does.
  await page.evaluate(() => {
    const g = window.__SF;
    Object.assign(g.body, { x: 0, z: 6, y: 0, vx: 0, vy: 0, vz: 0 });
  });
  await page.keyboard.down("KeyR");
  await page.waitForFunction(() => window.__SF.state.place === "frontier");
  await page.keyboard.up("KeyR");
  // The frontier wetland, still starved by the blocked landslide, renders a sparse band.
  report.frontierReedsBefore = await page.evaluate(
    () => window.__SF.habitat.reeds.count,
  );
  assert.ok(
    report.frontierReedsBefore < 8,
    `a blocked wetland must render a sparse reed band, got ${report.frontierReedsBefore}`,
  );

  // Repair is real input from here on: the same held-Hose path browser:watershed
  // proves, on the debris shore. The body drifts, so each pulse re-finds its footing.
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
        g.rig.yaw = Math.PI;
        g.rig.pitch = 0;
        g.rig.initial = true;
      },
      [x, z, y, mode, grounded],
    );
    await page.waitForTimeout(400);
  };
  await page.keyboard.down("Space");
  await page.waitForFunction(() => window.__SF.body.hoseActive === true);
  let cleared = false;
  for (let attempt = 0; attempt < 90 && !cleared; attempt++) {
    await place(-6, 14, -0.22, "swim", false);
    cleared =
      (await page.evaluate(
        () => window.__SF.state.watershed.nodes[1].blockage,
      )) < 1e-6;
  }
  await page.keyboard.up("Space");
  await page.waitForFunction(() => window.__SF.body.hoseActive === false, null, {
    timeout: 15000,
  });
  report.blockageCleared = await page.evaluate(
    () => window.__SF.state.watershed.nodes[1].blockage,
  );
  assert.ok(
    cleared,
    `aimed hosing has to clear the landslide, left ${report.blockageCleared}`,
  );

  // The player saves through the real control, then is away for half an hour: the
  // stored wall clock is rewound by hand, which is this journey's one privileged
  // fixture and stands in for a wait no test can afford.
  await page.click("#settings-toggle");
  await page.click("#save");
  await page.waitForFunction(() =>
    document
      .querySelector("#status")
      .textContent.includes("This place is remembered."),
  );
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
  await page.waitForFunction(() => window.__SF?.loop.frames.length > 5);
  await page.waitForFunction(
    () =>
      window.__SF.state.watershed.nodes[2].wetness > 0.6 &&
      window.__SF.state.ecosystem.labFrogs > 0.1,
    null,
    { timeout: 30000 },
  );
  report.absence = await page.evaluate(() => ({
    wetness: window.__SF.state.watershed.nodes[2].wetness,
    labFrogs: window.__SF.state.ecosystem.labFrogs,
    labWater: window.__SF.state.ecosystem.labWater,
  }));

  // The same wetland now renders a full band: the repair the jets made is what grew.
  await place(-6, 12, null, "land", true);
  report.frontierReedsAfter = await page.evaluate(
    () => window.__SF.habitat.reeds.count,
  );
  assert.ok(
    report.frontierReedsAfter > 24,
    `a repaired wetland must render a full reed band, got ${report.frontierReedsAfter}`,
  );

  // Walk in through the door: the basin the jets fed, now rendered as a living one.
  await place(-11, 6, null, "land", true);
  await page.keyboard.down("KeyR");
  await page.waitForFunction(() => window.__SF.state.place === "lab");
  await page.keyboard.up("KeyR");
  report.labAfter = await page.evaluate(() => {
    const lab = window.__SF.labView();
    return {
      labReeds: lab.reeds.count,
      labFrogs: lab.animals.count,
      basinOpacity: lab.basin.material.opacity,
    };
  });
  assert.ok(
    report.labAfter.labReeds > 24,
    `the fed basin must render reeds, got ${report.labAfter.labReeds}`,
  );
  assert.ok(
    report.labAfter.labFrogs > 0,
    "the colonised basin must render its frogs",
  );
  assert.ok(
    report.labAfter.basinOpacity > 0.5,
    "the fed basin must render deeper water",
  );
  await page.screenshot({ path: "artifacts/lab-after.png" });
  // The basin itself is the proof: water depth, reeds and frogs changed without
  // requiring a special diagnostic input.

  // Rest near the platform: the same five-minute advance through the same simulation.
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
    // Composition in here depends on which shared geometries the repair leg uploaded
    // before the first cycle, so the guard is the invariant that matters: the lab
    // never accumulates. A leak of one geometry per cycle breaches the ceiling well
    // before the last cycle, and teardown below must still reach exactly zero.
    assert.ok(
      s.memory.geometries <= 22,
      `lab geometries bounded including the persistent shoreline and one Atmosphere geometry, cycle ${i}: ${s.memory.geometries}`,
    );
    report.cycles.push({ memory: s.memory, assets: s.assets });
  }
  assert.ok(
    report.cycles.at(-1).memory.geometries <= report.cycles[0].memory.geometries + 1,
    "lab geometries must not grow across cycles",
  );
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
    "Jet-driven interaction, UI save, thirty-minute absence, colonization rendered on both sides, physical Lab change, rest guard, 12 Lab/frontier cycles and zero-resource teardown passed; vantage and door placements are teleports, and the absence is a rewound saved clock standing in for a wait.",
  );
} finally {
  await writeFile(
    "docs/qa/habitat-browser.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
