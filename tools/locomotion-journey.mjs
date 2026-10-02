// Continuous Locomotion Zero journey. No body/pose/velocity writes, place jumps,
// time acceleration or saves fabricated by the harness. Steering uses the normal
// camera-relative input stick; buttons use the same action state as touch input.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { launchBrowser } from "./browser-launch.mjs";
const evidence = {
  environment:
    "Chromium / SwiftShader software rendering; not hardware FPS, human feel, audible audio, or physical-device touch evidence",
  route:
    "spawn → shallows → dive → surface → bank → shell → jet → rock contact → north beyond 70 m → return",
  errors: [],
};
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on("pageerror", (e) => evidence.errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__SF?.streaming.stats().queued === 0);
  evidence.continuous = await page.evaluate(async () => {
    const g = window.__SF,
      frames = [],
      legs = [],
      modes = new Set(),
      chunks = new Set();
    const update = g.loop.update,
      responses = [];
    let request = null,
      peakImpact = 0,
      contactFrames = 0,
      worstPenetration = 0,
      maxAimErrorRadians = 0;
    // Observe the existing update; never call an extra step or alter dt/state.
    g.loop.update = (...args) => {
      const x = g.body.x,
        z = g.body.z;
      update(...args);
      if (request) {
        request.ticks++;
        if (Math.hypot(g.body.x - x, g.body.z - z) > 1e-6) {
          responses.push(request);
          request = null;
        }
      }
    };
    const origin = { x: g.body.x, z: g.body.z };
    let last = { x: g.body.x, y: g.body.y, z: g.body.z, time: g.loop.simTime },
      maxStep = 0,
      maxSpeedExcess = 0,
      missingGround = 0,
      maxSamples = 0,
      maxSwaps = 0,
      maxDensityStep = 0,
      density = g.scene.fog.density,
      jetStarts = 0,
      wasJet = false,
      lastFrame = performance.now();
    const sample = () => {
      const b = g.body,
        time = g.loop.simTime,
        step = Math.hypot(b.x - last.x, b.z - last.z),
        elapsed = time - last.time,
        now = performance.now();
      frames.push(now - lastFrame);
      lastFrame = now;
      if (![b.x, b.y, b.z, b.vx, b.vy, b.vz, b.yaw].every(Number.isFinite))
        throw new Error("Non-finite body");
      maxStep = Math.max(maxStep, step);
      maxSpeedExcess = Math.max(maxSpeedExcess, step - 12 * elapsed);
      const c = g.streaming.chunks,
        key = c.keyOf(Math.floor(b.x / 24), Math.floor(b.z / 24));
      chunks.add(key);
      if (!c.chunks.has(key)) missingGround++;
      maxSamples = Math.max(maxSamples, c.work.lastSamples || 0);
      maxSwaps = Math.max(maxSwaps, c.pendingSwaps);
      maxDensityStep = Math.max(
        maxDensityStep,
        Math.abs(g.scene.fog.density - density),
      );
      density = g.scene.fog.density;
      const aim = g.aim();
      if (aim) {
        const cp = Math.cos(g.rig.pitch),
          expected = [
            Math.sin(g.rig.yaw) * cp,
            -Math.sin(g.rig.pitch),
            Math.cos(g.rig.yaw) * cp,
          ],
          dot = aim.x * expected[0] + aim.y * expected[1] + aim.z * expected[2];
        maxAimErrorRadians = Math.max(
          maxAimErrorRadians,
          Math.acos(Math.min(1, Math.max(-1, dot))),
        );
      }
      peakImpact = Math.max(peakImpact, b.impact);
      if (b.blocked === "solid") contactFrames++;
      for (const o of g.region.obstaclesAt(b.x, b.z)) {
        const base = g.region.sample(o.x, o.z).height;
        if (b.y + 0.23 <= base || b.y - 0.23 >= base + o.height) continue;
        worstPenetration = Math.max(
          worstPenetration,
          o.radius + 0.23 - Math.hypot(b.x - o.x, b.z - o.z),
        );
      }
      modes.add(b.mode);
      if (b.jetTime > 0 && !wasJet) jetStarts++;
      wasJet = b.jetTime > 0;
      last = { x: b.x, y: b.y, z: b.z, time };
    };
    const clear = () => {
      g.input.stick = { x: 0, z: 0 };
      g.input.actions = {};
    };
    const leg = async (name, target, actions = {}, seconds = 0) => {
      const start = g.loop.simTime,
        wallStart = performance.now(),
        distance = g.body.distance;
      g.input.actions = actions;
      if (name === "water entry") request = { leg: name, ticks: 0 };
      while (true) {
        const b = g.body,
          dx = target ? target.x - b.x : 0,
          dz = target ? target.z - b.z : 0,
          d = Math.hypot(dx, dz);
        if (seconds > 0 ? g.loop.simTime - start >= seconds : target && d < 0.5)
          break;
        if (
          g.loop.simTime - start > 65 ||
          performance.now() - wallStart > 120000
        )
          throw new Error(
            `${name} stalled at (${b.x.toFixed(2)},${b.z.toFixed(2)}) mode=${b.mode}`,
          );
        const m = Math.max(1, d),
          x = dx / m,
          z = dz / m,
          yaw = g.rig.yaw;
        g.input.stick = {
          x: -x * Math.cos(yaw) + z * Math.sin(yaw),
          z: x * Math.sin(yaw) + z * Math.cos(yaw),
        };
        await new Promise(requestAnimationFrame);
        sample();
      }
      clear();
      legs.push({
        name,
        seconds: +(g.loop.simTime - start).toFixed(2),
        metres: +(g.body.distance - distance).toFixed(2),
        x: +g.body.x.toFixed(2),
        z: +g.body.z.toFixed(2),
        y: +g.body.y.toFixed(2),
        mode: g.body.mode,
      });
    };
    await leg("water entry", { x: -1, z: 18 });
    await leg("dive", null, { dive: true }, 1.5);
    await leg("underwater jet", null, { dive: true, jet: true }, 0.15);
    await leg("ascent", null, { ascend: true }, 3);
    await leg("shore exit", { x: -12, z: 18 }, { ascend: true });
    await leg("shell travel", { x: -12, z: 40 }, { slide: true }, 0.8);
    await leg("recover on land", null, {}, 1.5);
    await leg("rock contact", { x: -17, z: 20 }, {}, 3);
    await leg("leave rock", { x: -12, z: 18 });
    await leg("northbound", { x: -10, z: 54 }, { run: true });
    await leg("beyond prototype boundary", { x: -10, z: 85 }, { run: true });
    await leg("southbound", { x: -10, z: 54 }, { run: true });
    await leg("return to bank", origin, { run: true });
    await leg("settle", null, {}, 1.5);
    g.loop.update = update;
    const sorted = frames.slice().sort((a, b) => a - b);
    return {
      origin,
      responses,
      peakImpact,
      contactFrames,
      worstPenetration,
      maxAimErrorRadians,
      legs,
      modes: [...modes],
      frames: frames.length,
      distinctChunks: chunks.size,
      jetStarts,
      maxFrameStep: maxStep,
      maxSpeedExcess,
      missingGround,
      maxFrameSamples: maxSamples,
      maxHeldSwaps: maxSwaps,
      maxFogStep: maxDensityStep,
      medianMs: sorted[Math.floor(sorted.length * 0.5)],
      p95Ms: sorted[Math.floor(sorted.length * 0.95)],
      totalMetres: g.body.distance,
      stats: g.stats(),
      final: { x: g.body.x, y: g.body.y, z: g.body.z },
      noTeleport: true,
    };
  });
  const c = evidence.continuous;
  for (const mode of ["land", "wade", "swim", "dive", "slide"])
    assert.ok(c.modes.includes(mode), `missing ${mode}`);
  assert.equal(
    c.responses[0]?.ticks,
    1,
    "movement did not respond on the next fixed step",
  );
  assert.ok(
    c.maxAimErrorRadians < 1e-6,
    "camera orientation and mechanical aim diverged",
  );
  assert.ok(c.contactFrames > 0, "route did not exercise solid contact");
  assert.ok(c.peakImpact > 0.05, "collision registered no impact");
  assert.ok(c.worstPenetration < 1e-5, "body overlapped a collision proxy");
  assert.ok(c.totalMetres > 130);
  assert.ok(c.distinctChunks >= 4);
  assert.ok(c.jetStarts > 0);
  assert.equal(c.missingGround, 0);
  assert.ok(
    c.maxSpeedExcess < 0.1,
    `unexplained horizontal displacement ${c.maxSpeedExcess}`,
  );
  assert.ok(c.maxFrameSamples <= 6130);
  assert.ok(c.maxHeldSwaps <= 2);
  assert.ok(c.maxFogStep < 0.105, "instant full fog transition");
  // A real request wins over contextual messages; diagnostics do not use the live region.
  await page.click("#settings-toggle");
  await page.click("#telemetry summary");
  await page.waitForFunction(() =>
    document
      .querySelector("#telemetry-values")
      .textContent.includes("Render scale"),
  );
  await page.click("#save");
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("remembered"),
  );
  evidence.feedback = await page.evaluate(() => ({
    status: document.querySelector("#status").textContent,
    telemetry: document.querySelector("#telemetry-values").textContent,
    telemetryLive: document
      .querySelector("#telemetry-values")
      .getAttribute("aria-live"),
  }));
  assert.equal(evidence.feedback.telemetryLive, "off");
  await page.keyboard.press("Escape");
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/locomotion-zero.png" });
  await page.evaluate(() => window.__SF.dispose());
  evidence.teardown = await page.evaluate(() => ({
    memory: { ...window.__SF.renderer.info.memory },
    chunks: window.__SF.streaming.stats(),
    assets: window.__SF.assets.stats(),
  }));
  assert.equal(evidence.teardown.memory.geometries, 0);
  assert.equal(evidence.teardown.memory.textures, 0);
  assert.equal(evidence.teardown.chunks.active, 0);
  assert.equal(evidence.teardown.assets.references, 0);
  assert.deepEqual(evidence.errors, []);
  evidence.verdict =
    "PASS: continuous input-driven locomotion; objective state, continuity, terrain-work and feedback checks only.";
  console.log(evidence.verdict);
} catch (e) {
  evidence.failure = e.message;
  throw e;
} finally {
  await mkdir("docs/qa", { recursive: true });
  await writeFile(
    "docs/qa/locomotion-journey.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  await browser.close();
}
