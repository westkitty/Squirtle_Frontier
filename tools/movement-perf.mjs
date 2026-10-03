import { launchBrowser } from "./browser-launch.mjs";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await launchBrowser();
const evidence = {
  environment:
    "Chromium 140 / ANGLE SwiftShader; sandbox software rendering. NOT hardware or mobile performance.",
  date: new Date().toISOString(),
  scenarios: [],
};
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__SF?.loop.frames.length > 15);
  for (const quality of ["high", "low"]) {
    await page.click("#settings-toggle");
    await page.selectOption("#quality", quality);
    await page.click("#settings-toggle");
    await page.evaluate(() => {
      window.__SF.loop.frames.length = 0;
    });
    await page.waitForFunction(
      () => window.__SF.loop.frames.length >= 120,
      null,
      { timeout: 90000 },
    );
    const measured = await page.evaluate(() => {
      const g = window.__SF,
        s = g.stats(),
        f = s.frames.slice(10).sort((a, b) => a - b),
        gl = g.renderer.getContext(),
        debug = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        samples: f.length,
        medianMs: f[Math.floor(f.length * 0.5)],
        p95Ms: f[Math.floor(f.length * 0.95)],
        memory: s.memory,
        render: s.render,
        heap: performance.memory?.usedJSHeapSize ?? null,
        renderer: debug
          ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER),
      };
    });
    evidence.scenarios.push({ quality, viewport: "960x640", ...measured });
  }
  // Controlled A/B of the renderer-only adaptation in this same environment.
  const measure = async (label, { enableAdaptive }) => {
    await page.click("#settings-toggle");
    await page.selectOption("#quality", "high");
    if ((await page.isChecked("#adaptive")) !== enableAdaptive)
      await page.click("#adaptive");
    await page.click("#settings-toggle");
    await page.evaluate(() => {
      window.__SF.loop.frames.length = 0;
    });
    await page.waitForFunction(
      () => {
        const g = window.__SF;
        return (
          g.loop.frames.length >= 150 ||
          (g.adaptive.value < 1 && g.loop.frames.length >= 110)
        );
      },
      null,
      { timeout: 120000 },
    );
    const r = await page.evaluate(() => {
      const g = window.__SF,
        f = g
          .stats()
          .frames.slice(10)
          .sort((a, b) => a - b),
        canvas = g.renderer.domElement;
      return {
        samples: f.length,
        medianMs: f[Math.floor(f.length * 0.5)],
        p95Ms: f[Math.floor(f.length * 0.95)],
        adaptiveValue: g.adaptive.value,
        adaptiveChangesCumulative: g.adaptive.changes,
        pixelRatio: g.renderer.getPixelRatio(),
        buffer: `${canvas.width}x${canvas.height}`,
        css: `${canvas.clientWidth}x${canvas.clientHeight}`,
        triangles: g.stats().render.triangles,
        geometryBytes: g.stats().memory.geometries,
      };
    });
    evidence.adaptiveAb ??= {};
    evidence.adaptiveAb[label] = r;
    return r;
  };
  const pinned = await measure("pinnedFullDetail", { enableAdaptive: false });
  const adapted = await measure("adaptiveEnabled", { enableAdaptive: true });
  evidence.adaptiveAb.findings = {
    bufferShrank:
      Number(adapted.buffer.split("x")[0]) <
      Number(pinned.buffer.split("x")[0]),
    layoutUnchanged: adapted.css === pinned.css,
    scaleReduced: adapted.adaptiveValue < pinned.adaptiveValue,
    fullDetailHealthy: pinned.medianMs <= 26,
    adaptiveResponseValid:
      adapted.adaptiveValue < pinned.adaptiveValue || pinned.medianMs <= 26,
    medianDeltaMs: +(adapted.medianMs - pinned.medianMs).toFixed(1),
    p95DeltaMs: +(adapted.p95Ms - pinned.p95Ms).toFixed(1),
    note: "Software rendering only. Triangle count is unchanged because adaptation scales pixels; hardware/mobile effect is unmeasured.",
  };
  assert.equal(evidence.adaptiveAb.findings.layoutUnchanged, true);
  assert.equal(
    evidence.adaptiveAb.findings.adaptiveResponseValid,
    true,
    "adaptive resolution must reduce under sustained pressure or remain full-size because full detail is already healthy",
  );
  if (evidence.adaptiveAb.findings.scaleReduced)
    assert.equal(evidence.adaptiveAb.findings.bufferShrank, true);
  // A carved groove forces high tessellation on the chunk that holds it, which is
  // only one of nine streamed chunks. Both the "in it" and "looking at it from the
  // next chunk over" views are measured, because the second is where detail cost
  // can be paid for nothing.
  const measureScene = async (label) => {
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      window.__SF.loop.frames.length = 0;
    });
    await page.waitForFunction(
      () => window.__SF.loop.frames.length >= 120,
      null,
      { timeout: 120000 },
    );
    const m = await page.evaluate(() => {
      const g = window.__SF,
        s = g.stats(),
        f = s.frames.slice(10).sort((a, b) => a - b);
      return {
        samples: f.length,
        medianMs: f[Math.floor(f.length * 0.5)],
        p95Ms: f[Math.floor(f.length * 0.95)],
        memory: s.memory,
        render: s.render,
      };
    });
    evidence.scenarios.push({ label, ...m });
    return m;
  };
  const lookAtTheCut = async (label, x, z, yaw) => {
    await page.evaluate(
      ([x, z, yaw]) => {
        const g = window.__SF;
        g.state.frontier.bypass = 1;
        g.state.frontier.channelErosion = 12;
        Object.assign(g.body, {
          x,
          z,
          y: g.state.sampleHeight(x, z),
          vx: 0,
          vy: 0,
          vz: 0,
          yaw,
        });
        g.rig.initial = true;
        g.streaming.refreshTerrain();
      },
      [x, z, yaw],
    );
    await page.waitForFunction(
      () => window.__SF.streaming.stats().queued === 0,
      null,
      {
        timeout: 60000,
      },
    );
    return measureScene(label);
  };
  evidence.channelCut = await lookAtTheCut(
    "channel-cut (standing in the groove)",
    -10,
    12,
    Math.PI,
  );
  evidence.channelDistant = await lookAtTheCut(
    "channel-cut (viewed from the next chunk over)",
    -30,
    30,
    Math.atan2(22, -20),
  );
  await page.evaluate(async () => {
    await window.__SF.dispose();
  });
  evidence.teardown = await page.evaluate(() => {
    const g = window.__SF;
    return {
      memory: { ...g.renderer.info.memory },
      chunks: g.streaming.stats(),
      assets: g.assets.stats(),
    };
  });
  assert.equal(evidence.teardown.chunks.active, 0);
  assert.equal(evidence.teardown.memory.geometries, 0);
  assert.equal(evidence.teardown.memory.textures, 0);
  assert.equal(evidence.teardown.assets.references, 0);
} finally {
  await writeFile(
    "docs/performance/phase1-measured.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  await browser.close();
}
console.log(JSON.stringify(evidence, null, 2));
