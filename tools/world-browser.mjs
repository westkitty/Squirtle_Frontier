import { launchBrowser } from "./browser-launch.mjs";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { BYPASS_SITE } from "../src/simulation/frontier-systems.js";
import {
  deepHistory,
  deepTimeLedger,
  recordRows,
} from "../src/simulation/deep-history.js";
const browser = await launchBrowser(),
  evidence = { errors: [], cycles: [] };
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  page.on("pageerror", (e) => evidence.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") evidence.errors.push(m.text());
  });
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__SF?.loop.frames.length > 10);
  // Position setup is explicitly teleported. Water Jet itself goes through keyboard/body rules.
  await page.evaluate(() => {
    const g = window.__SF;
    Object.assign(g.body, {
      x: -10,
      z: 12,
      y: g.region.sample(-10, 12).height,
      yaw: Math.PI,
      jetTime: 0,
      jetCooldown: 0,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.rig.yaw = Math.PI;
    g.rig.pitch = 0;
    g.rig.initial = true;
  });
  await page.keyboard.down("Space");
  await page.waitForFunction(() => window.__SF.body.hoseActive === true);
  await page.waitForFunction(() => window.__SF.state.frontier.bypass > 0.02);
  await page.keyboard.up("Space");
  await page.waitForFunction(() => window.__SF.body.hoseActive === false);
  evidence.bypass = await page.evaluate(
    () => window.__SF.state.frontier.bypass,
  );
  await page.evaluate(() => {
    const g = window.__SF;
    g.state.frontier.heat[0] = 0.9;
    Object.assign(g.body, {
      x: 12,
      z: -6,
      y: g.region.sample(12, -6).height,
      yaw: Math.PI,
      jetCooldown: 0,
      jetTime: 0,
      vx: 0,
      vz: 0,
      vy: 0,
    });
    g.rig.yaw = Math.PI;
    g.rig.pitch = 0;
    g.rig.initial = true;
  });
  await page.keyboard.down("Space");
  await page.waitForFunction(() => window.__SF.body.hoseActive === true);
  await page.waitForFunction(() => window.__SF.state.frontier.soaked[0] > 0.05);
  await page.keyboard.up("Space");
  evidence.suppression = await page.evaluate(() => ({
    heat: window.__SF.state.frontier.heat[0],
    soaked: window.__SF.state.frontier.soaked[0],
  }));
  await page.screenshot({ path: "artifacts/world-fire.png" });
  // The memory panel remains about places and witnessed events, not a live
  // hydrology instrument. Named-reach telemetry is deliberately absent.
  await page.click("#memory-toggle");
  await page.waitForFunction(
    () => document.querySelector("#survey").children.length > 0,
  );
  evidence.drinkNote = await page.evaluate(
    () => document.querySelector("#drink-note").textContent,
  );
  evidence.memoryInstrument = await page.evaluate(() => ({
    playerMarker: !!document.querySelector("[data-map-player]"),
    facingMarker: !!document.querySelector("[data-map-facing]"),
    mapLabel: document.querySelector("#survey").getAttribute("aria-label"),
    landmarkMarkers: document.querySelectorAll("[data-map-landmark]").length,
    reachTraces: document.querySelectorAll("[data-map-reach]").length,
    reachMouths: document.querySelectorAll("[data-map-mouth]").length,
    liveWaterNote: !!document.querySelector("#water-note"),
    liveWaterQuality: !!document.querySelector("#water-quality-note"),
    drinkMarkers: document.querySelectorAll("[data-map-drink]").length,
    rememberedPlaces: window.__SF.state.memory.places.length,
  }));
  assert.equal(evidence.memoryInstrument.playerMarker, true);
  assert.equal(evidence.memoryInstrument.facingMarker, true);
  assert.equal(evidence.memoryInstrument.reachTraces, 0);
  assert.equal(evidence.memoryInstrument.reachMouths, 0);
  assert.equal(evidence.memoryInstrument.liveWaterNote, false);
  assert.equal(evidence.memoryInstrument.liveWaterQuality, false);
  assert.equal(
    evidence.memoryInstrument.landmarkMarkers,
    evidence.memoryInstrument.rememberedPlaces,
    "survey landmark markers must reveal remembered places only",
  );
  assert.equal(
    evidence.memoryInstrument.drinkMarkers,
    0,
    "the survey must not invent drinking sites before any are observed",
  );
  assert.match(evidence.memoryInstrument.mapLabel, /revisit intensity/);
  assert.match(evidence.memoryInstrument.mapLabel, /facing/);
  assert.doesNotMatch(evidence.memoryInstrument.mapLabel, /waterway|reach/i);
  assert.equal(
    evidence.drinkNote,
    "No drink tracks yet. Animals drink where the shallows run clean.",
    "an empty drink log must not invent a site",
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelector("#strata-note").textContent,
    ),
    "Nothing of the record is logged. Hold still inside a band of it until the shaft agrees you read it.",
    "the panel cannot claim a reading the player never made",
  );
  await page.screenshot({ path: "artifacts/world-memory.png" });
  await page.click("#memory-toggle");
  await page.locator("canvas").click({ position: { x: 400, y: 350 } });
  await page.evaluate(() => {
    const g = window.__SF;
    g.enterPlace("lab");
    Object.assign(g.body, {
      x: 0,
      z: 0,
      y: -1.1,
      mode: "dive",
      grounded: false,
    });
  });
  await page.keyboard.down("KeyR");
  await page.waitForFunction(() => window.__SF.state.place === "record");
  await page.keyboard.up("KeyR");
  await page.keyboard.down("KeyQ");
  await page.waitForFunction(() => window.__SF.body.y < -7);
  await page.keyboard.up("KeyQ");
  await page.screenshot({ path: "artifacts/world-record.png" });
  // Hold the body still: a drifting y would make the painted row and the measured row
  // disagree for reasons that have nothing to do with the readout being honest.
  const pinInShaft = () =>
    page.evaluate(() => {
      const g = window.__SF;
      Object.assign(g.body, { x: 0, z: 0, y: -12.4, vx: 0, vy: 0, vz: 0 });
      g.rig.initial = true;
    });
  const readRecord = async (pin = true) => {
    if (pin) await pinInShaft();
    return page.evaluate(() => ({
      y: window.__SF.body.y,
      hidden: document.querySelector("#record-readout").hidden,
      caption: document.querySelector("#status").textContent,
      seed: window.__SF.state.seed,
      rows: [...document.querySelectorAll("#record-readout div")].map((d) => ({
        label: d.querySelector("dt").textContent,
        value: d.querySelector("dd").textContent,
      })),
      live: {
        tick: window.__SF.state.frontier.tick,
        stage: window.__SF.state.frontier.stage,
        diversion: window.__SF.state.frontier.diversion,
        history: window.__SF.state.frontier.history,
        strata: window.__SF.state.memory.strata,
        nodes: window.__SF.state.watershed.nodes.map((n) => ({
          id: n.id,
          erosion: n.erosion,
          sediment: n.sediment,
        })),
      },
    }));
  };
  const expectRows = (r) =>
    recordRows(
      deepTimeLedger({
        eras: deepHistory(r.seed),
        y: r.y,
        tick: r.live.tick,
        history: r.live.history,
        nodes: r.live.nodes,
        stage: r.live.stage,
        diversion: r.live.diversion,
        read: r.live.strata,
      }),
    );
  // The rows are painted during a frame and the graph advances on the same tick, so the
  // two can be a frame apart on read. Retry until they line up rather than loosening the
  // comparison: this asserts the exact measured strings, or nothing.
  let recordDom = await readRecord(),
    expected = expectRows(recordDom),
    mismatch = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    mismatch = null;
    for (let i = 0; i < expected.length; i++)
      if ((recordDom.rows[i]?.value ?? null) !== expected[i].value)
        mismatch = `row "${expected[i].label}": screen "${
          recordDom.rows[i]?.value
        }" vs measurement "${expected[i].value}"`;
    if (!mismatch) break;
    await page.waitForTimeout(60);
    recordDom = await readRecord();
    expected = expectRows(recordDom);
  }
  evidence.record = { y: recordDom.y, caption: recordDom.caption };
  assert.equal(
    recordDom.hidden,
    false,
    "the shaft readout belongs to the record",
  );
  assert.ok(expected.length >= 8, "the instrument has rows to compare");
  assert.equal(
    mismatch,
    null,
    "the screen must show the measurement, row for row",
  );
  const cutRow = recordDom.rows.find((r) => r.label === "your cut");
  assert.match(cutRow.value, /% of the 22 m below you/);
  assert.match(cutRow.value, /^the side groove is /);
  evidence.recordRows = recordDom.rows;
  // Earning a reading must not need a fixture. Sink to the floor of the shaft with the
  // descend key, let go, and require the band to log itself while nothing but the
  // simulation moves the body: pinning here would have proven only the pin, which is
  // exactly how a hold rule no player could satisfy once shipped.
  await page.keyboard.down("KeyQ");
  await page.waitForFunction(() => window.__SF.body.y < -21, null, {
    timeout: 30000,
  });
  await page.keyboard.up("KeyQ");
  const read = () => readRecord(false);
  let logged = await read();
  for (let i = 0; i < 150 && !logged.live.strata.length; i++) {
    await page.waitForTimeout(100);
    logged = await read();
  }
  assert.ok(
    logged.live.strata.length > 0,
    "sitting on the floor of the shaft has to log the band you are in",
  );
  // Rows are painted during a frame and the graph advances in it, so settle until the
  // screen and a recomputation from the same read agree, then assert what it reached.
  let loggedMismatch = "unsettled";
  for (let i = 0; i < 40; i++) {
    logged = await read();
    loggedMismatch =
      expectRows(logged)
        .map((r) => r.value)
        .join("\n") === logged.rows.map((r) => r.value).join("\n")
        ? null
        : `screen ${JSON.stringify(logged.rows.map((r) => r.value))} vs measurement ${JSON.stringify(
            expectRows(logged).map((r) => r.value),
          )}`;
    if (!loggedMismatch) break;
    await page.waitForTimeout(60);
  }
  const band = Number(logged.rows[1].value.match(/^(\d+) of \d+/)[1]);
  assert.equal(
    logged.live.strata.length,
    1,
    "one band sat in is one band learned, not one per second",
  );
  assert.equal(
    logged.live.strata[0] + 1,
    band,
    "the learned band has to be the one the readout is on",
  );
  assert.equal(
    band,
    8,
    "the floor of the shaft sits in the deepest band, not a hypothetical one",
  );
  assert.match(logged.rows[1].value, /· read$/);
  assert.equal(
    logged.rows.find((r) => r.label === "record read").value,
    "1 of 8 bands logged",
  );
  assert.equal(
    loggedMismatch,
    null,
    "a logged band has to be in the measurement too",
  );
  evidence.recordLogged = {
    strata: logged.live.strata,
    band,
    y: +logged.y.toFixed(2),
  };
  await page.evaluate(() => {
    if (document.querySelector("#memory").hidden)
      document.querySelector("#memory-toggle").click();
  });
  await page.waitForFunction(() => !document.querySelector("#memory").hidden);
  await page.waitForTimeout(300);
  evidence.strataNote = await page.evaluate(
    () => document.querySelector("#strata-note").textContent,
  );
  assert.equal(
    evidence.strataNote,
    `The record is read in 1 of 8 bands, down to band ${evidence.recordLogged.band}.`,
    "the panel has to report the same single reading the shaft logged",
  );
  // Menus intentionally suppress creature controls. Close Memory before resuming the
  // physical ascent so this journey exercises the real user path rather than relying on
  // the pre-uplift behavior where movement leaked through panels.
  await page.click('[data-close-panel="memory"]');
  await page.waitForFunction(
    () =>
      document.activeElement.tagName === "CANVAS" &&
      window.__SF.input.suppressed === false,
  );
  await page.keyboard.down("KeyE");
  await page.waitForFunction(() => window.__SF.body.y > -1, null, {
    timeout: 30000,
  });
  await page.keyboard.up("KeyE");
  await page.keyboard.down("KeyR");
  await page.waitForFunction(() => window.__SF.state.place === "lab");
  await page.keyboard.up("KeyR");
  await page.waitForFunction(
    () => document.querySelector("#record-readout").hidden,
    null,
    { timeout: 5000 },
  );
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => window.__SF.enterPlace("record"));
    await page.waitForTimeout(100);
    await page.evaluate(() => window.__SF.enterPlace("lab"));
    await page.waitForTimeout(100);
    const s = await page.evaluate(() => window.__SF.stats());
    assert.equal(s.chunks.active, 0);
    assert.equal(s.assets.references, 1);
    assert.ok(
      s.memory.geometries <= 21,
      "room cycling includes one persistent atmosphere geometry and must remain bounded",
    );
    evidence.cycles.push(s.memory);
  }
  await page.evaluate(() => window.__SF.dispose());
  evidence.teardown = await page.evaluate(() => {
    const s = window.__SF.stats();
    delete s.frames;
    return s;
  });
  assert.equal(evidence.teardown.memory.geometries, 0);
  assert.equal(evidence.teardown.memory.textures, 0);
  assert.deepEqual(evidence.errors, []);
  console.log(
    "Input-driven bypass/fire, memory map, Deep Record dive/ascent, 12 room cycles and teardown passed.",
  );
} finally {
  await writeFile(
    "docs/qa/world-browser.json",
    JSON.stringify(evidence, null, 2),
  );
  await browser.close();
}
