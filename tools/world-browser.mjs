import { launchBrowser } from "./browser-launch.mjs";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { REACHES, SPRING_SITE } from "../src/simulation/reaches.js";
import { BYPASS_SITE } from "../src/simulation/frontier-systems.js";
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
  });
  await page.keyboard.down("Space");
  await page.waitForFunction(() => window.__SF.state.frontier.bypass > 0.02);
  await page.keyboard.up("Space");
  await page.waitForFunction(() => window.__SF.body.jetTime === 0);
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
  });
  await page.keyboard.down("Space");
  await page.waitForFunction(() => window.__SF.state.frontier.soaked[0] > 0.05);
  await page.keyboard.up("Space");
  evidence.suppression = await page.evaluate(() => ({
    heat: window.__SF.state.frontier.heat[0],
    soaked: window.__SF.state.frontier.soaked[0],
  }));
  await page.screenshot({ path: "artifacts/world-fire.png" });
  // Following the water: stand at the head of the longest inflow, listen with
  // Current Sense, then check the map learned the reach. Position is teleported.
  const standOn = (spot) =>
    page.evaluate((p) => {
      const g = window.__SF;
      Object.assign(g.body, {
        x: p.x,
        z: p.z,
        y: g.state.sampleHeight(p.x, p.z),
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: Math.PI,
      });
      g.rig.initial = true;
    }, spot);
  await standOn({ x: SPRING_SITE.x, z: SPRING_SITE.z });
  await page.waitForTimeout(1600);
  await page.keyboard.down("KeyF");
  await page.waitForTimeout(250);
  evidence.senseAtSpring = await page.evaluate(
    () => document.querySelector("#status").textContent,
  );
  await page.keyboard.up("KeyF");
  assert.match(evidence.senseAtSpring, /You are on the Spring gully/);
  assert.match(evidence.senseAtSpring, /\d+ m above the shallows\./);
  await standOn({ x: BYPASS_SITE.x, z: BYPASS_SITE.z });
  await page.waitForTimeout(1600);
  await page.keyboard.down("KeyF");
  await page.waitForTimeout(250);
  evidence.senseAtGroove = await page.evaluate(
    () => document.querySelector("#status").textContent,
  );
  await page.keyboard.up("KeyF");
  assert.match(evidence.senseAtGroove, /You are on the Drainage groove/);
  assert.match(
    evidence.senseAtGroove,
    /(still a dry groove|carrying water)/,
    "a cut channel has to say whether it is running",
  );
  evidence.reachCounts = await page.evaluate(() =>
    window.__SF.state.memory.reaches.join(","),
  );
  assert.equal(
    evidence.reachCounts,
    "spring-gully,drainage-groove",
    "only routes actually stood on are remembered",
  );
  await page.click("#memory-toggle");
  await page.waitForFunction(
    () => document.querySelector("#survey").children.length > 0,
  );
  evidence.drinkNote = await page.evaluate(
    () => document.querySelector("#drink-note").textContent,
  );
  assert.equal(
    evidence.drinkNote,
    "No drink tracks yet. Animals drink where the shallows run clean.",
    "an empty drink log must not invent a site",
  );
  evidence.waterNote = await page.evaluate(
    () => document.querySelector("#water-note").textContent,
  );
  assert.match(evidence.waterNote, /Spring gully \(\d+ m\)/);
  assert.match(evidence.waterNote, /2 of \d+ reaches\./);
  evidence.reachGeometry = await page.evaluate(() => ({
    geometries: window.__SF.renderer.info.memory.geometries,
    followed: window.__SF.state.memory.reaches.length,
  }));
  assert.equal(evidence.reachGeometry.followed, 2);
  assert.equal(REACHES.length, 6, "five inflows plus the cut groove");
  assert.ok(
    evidence.reachGeometry.geometries <= 24,
    "one shared line mesh for the whole network",
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
  evidence.record = await page.evaluate(() => ({
    y: window.__SF.body.y,
    caption: document.querySelector("#status").textContent,
  }));
  await page.keyboard.down("KeyE");
  await page.waitForFunction(() => window.__SF.body.y > -1, null, {
    timeout: 30000,
  });
  await page.keyboard.up("KeyE");
  await page.keyboard.down("KeyR");
  await page.waitForFunction(() => window.__SF.state.place === "lab");
  await page.keyboard.up("KeyR");
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => window.__SF.enterPlace("record"));
    await page.waitForTimeout(100);
    await page.evaluate(() => window.__SF.enterPlace("lab"));
    await page.waitForTimeout(100);
    const s = await page.evaluate(() => window.__SF.stats());
    assert.equal(s.chunks.active, 0);
    assert.equal(s.assets.references, 1);
    assert.ok(s.memory.geometries <= 20);
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
