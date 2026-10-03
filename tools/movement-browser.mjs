import { launchBrowser } from "./browser-launch.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir("artifacts", { recursive: true });
const browser = await launchBrowser();
const errors = [],
  evidence = {
    environment:
      "Chromium 140 / ANGLE SwiftShader; NOT hardware or mobile performance evidence",
    journey: [],
    checkpoints: [],
    assetCycles: [],
  };
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await page.waitForFunction(
    () =>
      window.__SF?.streaming.stats().active === 9 &&
      window.__SF.loop.frames.length > 10,
  );
  const mark = async (name) =>
    evidence.journey.push({
      name,
      ...(await page.evaluate(() => ({
        body: { ...window.__SF.body },
        stats: window.__SF.stats(),
      }))),
    });
  const position = await page.evaluate(() => ({ ...window.__SF.body }));
  await page.keyboard.down("KeyW");
  await page.keyboard.down("ShiftLeft");
  await page.waitForFunction((z) => window.__SF.body.z < z - 2, position.z);
  await page.keyboard.up("KeyW");
  await page.keyboard.up("ShiftLeft");
  await mark("keyboard land running");
  const landEffects = await page.evaluate(() => window.__SF.stats().effects);
  assert.equal(landEffects.jet, 0, "ordinary land movement must not fire Water Jet");
  assert.equal(landEffects.spray, 0, "ordinary land movement must not emit water spray");
  await page.keyboard.down("KeyC");
  await page.waitForFunction(
    () => window.__SF.body.mode === "slide" && window.__SF.creature.shell > 0.9,
  );
  await mark("shell slide");
  await page.screenshot({ path: "artifacts/phase1-slide.png" });
  await page.keyboard.up("KeyC");
  await page.keyboard.down("Space");
  await page.waitForFunction(() => window.__SF.body.jetCooldown > 0);
  await mark("land Water Jet");
  await page.keyboard.up("Space");
  // Walk physically from bank into water, not by setting the movement state.
  await page.keyboard.down("KeyD");
  await page.keyboard.down("ShiftLeft");
  await page.waitForFunction(
    () => ["swim", "dive"].includes(window.__SF.body.mode),
    null,
    { timeout: 45000 },
  );
  await page.keyboard.up("KeyD");
  await page.keyboard.up("ShiftLeft");
  await page.waitForFunction(() => window.__SF.body.jetTime === 0);
  await mark("water entry");
  const swimEffects = await page.evaluate(() => window.__SF.stats().effects);
  assert.equal(swimEffects.jet, 0, "ordinary swimming must not fire Water Jet");
  assert.equal(swimEffects.spray, 0, "ordinary swimming must not emit the Jet particle stream");
  await page.keyboard.down("KeyD");
  await page.waitForFunction(() => window.__SF.body.x > -3, null, {
    timeout: 30000,
  });
  await page.keyboard.up("KeyD");
  await page.waitForFunction(
    () => Math.hypot(window.__SF.body.vx, window.__SF.body.vz) < 0.5,
  );
  await page.screenshot({ path: "artifacts/phase1-swim.png" });
  await page.keyboard.down("KeyQ");
  await page.waitForFunction(() => window.__SF.body.y < -2.1);
  await page.keyboard.up("KeyQ");
  await mark("dive");
  await page.screenshot({ path: "artifacts/phase1-dive.png" });
  await page.keyboard.down("Space");
  await page.waitForFunction(() => window.__SF.body.jetTime > 0.1);
  await mark("underwater boost");
  await page.keyboard.up("Space");
  await page.keyboard.down("KeyE");
  await page.waitForFunction(() => window.__SF.body.mode === "swim", null, {
    timeout: 30000,
  });
  await page.keyboard.up("KeyE");
  await mark("ascent");
  await page.keyboard.down("Space");
  await page.waitForFunction(() => window.__SF.body.y > 0.1);
  await mark("surface launch");
  await page.keyboard.up("Space");
  await page.mouse.move(480, 300);
  await page.mouse.down();
  await page.mouse.move(650, 345, { steps: 5 });
  await page.mouse.up();
  await mark("drag camera");
  await page.click("#settings-toggle");
  // Reduced motion is tri-state; "reduce" must apply immediately, not on reload.
  await page.selectOption("#motion", "reduce");
  assert.equal(
    await page.evaluate(() =>
      document.body.classList.contains("reduced-motion"),
    ),
    true,
  );
  await page.selectOption("#quality", "low");
  await page.click("#reset");
  await page.click("#save");
  const saved = await page.evaluate(() => ({ ...window.__SF.state.player }));
  await page.reload();
  await page.waitForFunction(() => window.__SF?.loop.frames.length > 10);
  assert.deepEqual(await page.evaluate(() => window.__SF.state.player), saved);
  assert.equal(
    await page.evaluate(
      () =>
        document.body.classList.contains("reduced-motion") &&
        JSON.parse(localStorage.getItem("squirtle_frontier_settings_v1"))
          .reducedMotion === true,
    ),
    true,
    "preference must survive reload",
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelector("canvas").clientWidth === innerWidth,
    ),
    true,
    "render scaling must not change CSS layout",
  );
  await mark("save and reload");
  // Return to matched pose for resource checks. Teleports below are explicitly lifecycle probes.
  await page.evaluate(() => {
    window.__SF.rig.yaw = Math.PI;
    window.__SF.rig.pitch = 0.26;
  });
  const home = await page.evaluate(() => ({ ...window.__SF.body }));
  const settle = async (x, z) => {
    await page.evaluate(
      ({ x, z }) => {
        const g = window.__SF;
        Object.assign(g.body, {
          x,
          z,
          y: g.region.sample(x, z).height,
          vx: 0,
          vy: 0,
          vz: 0,
          mode: "land",
          jetTime: 0,
          jetCooldown: 0,
        });
        g.rig.initial = true;
      },
      { x, z },
    );
    await page.waitForFunction(
      ({ x, z }) => {
        const g = window.__SF;
        return (
          g.streaming.chunks.center.i === Math.floor(x / 24) &&
          g.streaming.chunks.center.j === Math.floor(z / 24) &&
          g.streaming.stats().queued === 0
        );
      },
      { x, z },
    );
  };
  // Warm every shared scenery geometry once; a first-ever rock upload is not a leak.
  for (const [x, z] of [
    [42, 38],
    [-42, -38],
    [42, -38],
    [-42, 38],
  ])
    await settle(x, z);
  await settle(home.x, home.z);
  const initial = await page.evaluate(() => window.__SF.stats());
  for (let i = 0; i < 12; i++) {
    await settle(i % 2 ? 42 : -42, i % 3 ? 38 : -38);
    await settle(home.x, home.z);
    const stats = await page.evaluate(() => window.__SF.stats());
    evidence.checkpoints.push(stats);
    assert.ok(
      stats.memory.geometries <= 24,
      "nine chunks plus seven movement, three watershed, three habitat and two effect geometries, allowing one chunk to overlap a rebuild, is a hard bound",
    );
    assert.equal(stats.memory.textures, initial.memory.textures);
    assert.equal(stats.assets.references, 1);
  }
  // Repeated skinned instances render once, own mutable materials, release deterministically.
  evidence.assetCycles = await page.evaluate(async () => {
    const { SquirtlePresentation } = await import(
      "/src/assets/squirtle-presentation.js"
    );
    const g = window.__SF,
      stats = [];
    for (let i = 0; i < 30; i++) {
      const extra = await SquirtlePresentation.create(g.assets);
      g.creature.root.parent.add(extra.root);
      extra.present({ ...g.body, x: g.body.x + 0.6 }, 1 / 60);
      const original = g.creature.materials[0].color.getHex();
      extra.materials[0].color.setHex(0xff0000);
      if (g.creature.materials[0].color.getHex() !== original)
        throw new Error("Shared mutable material");
      g.renderer.render(g.creature.root.parent, g.rig.camera);
      extra.dispose();
      g.renderer.render(g.creature.root.parent, g.rig.camera);
      stats.push({
        memory: { ...g.renderer.info.memory },
        assets: g.assets.stats(),
      });
    }
    return stats;
  });
  for (const stats of evidence.assetCycles) {
    assert.ok(
      stats.memory.geometries <= 24,
      "nine chunks plus seven movement, three watershed, three habitat and two effect geometries, allowing one chunk to overlap a rebuild, is a hard bound",
    );
    assert.equal(stats.memory.textures, initial.memory.textures);
    assert.equal(stats.assets.references, 1);
  }
  evidence.desktop = await page.evaluate(() => window.__SF.stats());
  await page.screenshot({ path: "artifacts/phase1-bank.png" });
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const touch = await mobile.newPage();
  touch.on("pageerror", (e) => errors.push(e.message));
  await touch.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await touch.waitForFunction(() => window.__SF?.loop.frames.length > 10);
  assert.equal(await touch.locator("#stick").isVisible(), true);
  assert.equal(
    await touch.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  // CDP touch events exercise real pointer handlers, including a cancellation.
  const cdp = await mobile.newCDPSession(touch);
  const stick = await touch.locator("#stick").boundingBox();
  const sx = stick.x + stick.width / 2,
    sy = stick.y + stick.height / 2;
  const z = await touch.evaluate(() => window.__SF.body.z);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: sx, y: sy - 32, id: 1 }],
  });
  await touch.waitForFunction((z) => window.__SF.body.z < z - 0.5, z);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  assert.equal(await touch.evaluate(() => window.__SF.input.sample().z), 0);
  await touch.screenshot({ path: "artifacts/phase1-touch.png" });
  evidence.touch = {
    viewport: "390x844 desktop emulation, not mobile hardware",
    movement: true,
    cancelClears: true,
    overflow: false,
  };
  await touch.setViewportSize({ width: 844, height: 390 });
  await touch.screenshot({ path: "artifacts/phase1-touch-landscape.png" });
  await mobile.close();
  evidence.errors = errors;
  assert.deepEqual(errors, []);
  console.log(
    "Movement, save/reload, 12 chunk return cycles, 30 asset cycles and touch journey passed. Human enjoyment remains unverified.",
  );
} finally {
  await writeFile(
    "artifacts/phase1-browser.json",
    JSON.stringify(evidence, null, 2),
  );
  await browser.close();
}
