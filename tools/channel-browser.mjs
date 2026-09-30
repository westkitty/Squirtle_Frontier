import { launchBrowser } from "./browser-launch.mjs";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await launchBrowser(),
  evidence = { errors: [], cycles: [] };
try {
  const p = await browser.newPage({ viewport: { width: 960, height: 640 } });
  p.on("pageerror", (e) => evidence.errors.push(e.message));
  await p.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await p.waitForFunction(() => window.__SF?.streaming.stats().active === 9);
  // Set up at groove explicitly; staged change then passes through authoritative tick.
  await p.evaluate(() => {
    const g = window.__SF;
    Object.assign(g.body, {
      x: -10,
      z: 11,
      y: g.state.sampleHeight(-10, 11),
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.state.frontier.bypass = 0.9;
    g.state.frontier.channelErosion = 9.99;
    g.rig.initial = true;
  });
  await p.waitForFunction(
    () =>
      window.__SF.state.frontier.stage === 4 &&
      window.__SF.streaming.stats().active === 9,
  );
  const inspect = () => {
    const g = window.__SF,
      chunk = g.streaming.chunks.chunks.get("-1,0"),
      p = chunk.mesh.geometry.attributes.position;
    let error = 0;
    for (let i = 0; i < p.count; i++)
      error = Math.max(
        error,
        Math.abs(
          p.getY(i) -
            g.state.sampleHeight(
              chunk.mesh.position.x + p.getX(i),
              chunk.mesh.position.z + p.getZ(i),
            ),
        ),
      );
    return { error, memory: g.stats().memory };
  };
  evidence.afterStage = await p.evaluate(inspect);
  assert.ok(evidence.afterStage.error < 1e-5);
  await p.screenshot({ path: "artifacts/channel-stage.png" });
  await p.evaluate(() => {
    window.__SF.loop.frames.length = 0;
  });
  await p.waitForFunction(() => window.__SF.loop.frames.length >= 90);
  evidence.performance = await p.evaluate(() => {
    const s = window.__SF.stats(),
      f = s.frames.slice(10).sort((a, b) => a - b);
    return {
      environment: "960x640 SwiftShader, stage 4; NOT hardware/mobile FPS",
      medianMs: f[Math.floor(f.length * 0.5)],
      p95Ms: f[Math.floor(f.length * 0.95)],
      render: s.render,
      memory: s.memory,
    };
  });
  await p.click("#settings-toggle");
  await p.click("#save");
  await p.reload();
  await p.waitForFunction(() => window.__SF?.streaming.stats().active === 9);
  assert.equal(await p.evaluate(() => window.__SF.state.frontier.stage), 4);
  for (let i = 0; i < 12; i++) {
    await p.evaluate(() => window.__SF.enterPlace("lab"));
    await p.waitForTimeout(80);
    await p.evaluate(() => window.__SF.enterPlace("frontier"));
    await p.waitForFunction(() => window.__SF.streaming.stats().active === 9);
    const result = await p.evaluate(inspect);
    assert.ok(result.error < 1e-5);
    assert.ok(result.memory.geometries <= 23);
    evidence.cycles.push(result);
  }
  await p.evaluate(() => window.__SF.dispose());
  evidence.teardown = await p.evaluate(() => ({
    ...window.__SF.renderer.info.memory,
  }));
  assert.equal(evidence.teardown.geometries, 0);
  assert.equal(evidence.teardown.textures, 0);
  assert.deepEqual(evidence.errors, []);
  console.log(
    "Stage transition, rendered height authority, reload and 12 return cycles passed.",
  );
} finally {
  await writeFile(
    "docs/qa/channel-browser.json",
    JSON.stringify(evidence, null, 2),
  );
  await browser.close();
}
