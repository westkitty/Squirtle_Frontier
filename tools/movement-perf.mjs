import { launchBrowser } from "./browser-launch.mjs";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const timingBudget = JSON.parse(
  readFileSync(new URL("../docs/performance/movement-budget.json", import.meta.url), "utf8"),
);
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
        raw = s.frames.slice(10),
        summarize = (values) => {
          const f = values.slice().sort((a, b) => a - b);
          return {
            samples: f.length,
            medianMs: f[Math.floor(f.length * 0.5)],
            p95Ms: f[Math.floor(f.length * 0.95)],
            p99Ms: f[Math.min(f.length - 1, Math.floor(f.length * 0.99))],
            maxMs: f.at(-1),
          };
        },
        summary = summarize(raw),
        gl = g.renderer.getContext(),
        debug = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        ...summary,
        windows: [summarize(raw.slice(0, 50)), summarize(raw.slice(-50))],
        over33Pct: +(raw.filter((ms) => ms > 33.4).length * 100 / raw.length).toFixed(1),
        over50Pct: +(raw.filter((ms) => ms > 50).length * 100 / raw.length).toFixed(1),
        memory: s.memory,
        render: s.render,
        performance: s.performance,
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
        p99Ms: f[Math.min(f.length - 1, Math.floor(f.length * 0.99))],
        maxMs: f.at(-1),
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
        raw = s.frames.slice(10),
        summarize = (values) => {
          const f = values.slice().sort((a, b) => a - b);
          return {
            samples: f.length,
            medianMs: f[Math.floor(f.length * 0.5)],
            p95Ms: f[Math.floor(f.length * 0.95)],
            p99Ms: f[Math.min(f.length - 1, Math.floor(f.length * 0.99))],
            maxMs: f.at(-1),
          };
        },
        summary = summarize(raw);
      return {
        ...summary,
        windows: [summarize(raw.slice(0, 50)), summarize(raw.slice(-50))],
        over33Pct: +(raw.filter((ms) => ms > 33.4).length * 100 / raw.length).toFixed(1),
        over50Pct: +(raw.filter((ms) => ms > 50).length * 100 / raw.length).toFixed(1),
        memory: s.memory,
        render: s.render,
        performance: s.performance,
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
      g.state.squirtleEcology.tick(
        g.state.watershed,
        g.state.ecosystem,
        g.state.settlement,
      );
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
    () =>
      window.__SF.squirtles.activeCount === 3 &&
      window.__SF.squirtleView.performanceStats().active === 3 &&
      window.__SF.squirtleView.performanceStats().pending === 0,
    null,
    { timeout: 30000 },
  );
  evidence.squirtles = await measureScene("three nearby Squirtles");
  assert.equal(evidence.squirtles.performance.squirtles.simulation.active, 3);
  assert.equal(evidence.squirtles.performance.squirtles.view.active, 3);
  await page.evaluate(() => {
    const g = window.__SF;
    Object.assign(g.body, { x: -10, z: 18, y: g.state.sampleHeight(-10, 18), vx: 0, vy: 0, vz: 0 });
    g.squirtles.leaveLocal();
    g.squirtleView.releaseAll();
    g.rig.initial = true;
  });

  const timingChecks = [
    ["high", evidence.scenarios.find((scenario) => scenario.quality === "high"), timingBudget.scenarios.high],
    ["channelCut", evidence.channelCut, timingBudget.scenarios.channelCut],
    ["channelDistant", evidence.channelDistant, timingBudget.scenarios.channelDistant],
    ["squirtles", evidence.squirtles, timingBudget.scenarios.squirtles],
  ];
  evidence.timingGate = {};
  for (const [label, measured, baseline] of timingChecks) {
    const limits = {
      medianMs: baseline.medianMs + timingBudget.toleranceMs,
      p95Ms: baseline.p95Ms + timingBudget.toleranceMs,
    };
    const windows = measured.windows ?? [];
    assert.equal(
      windows.length,
      timingBudget.confirmationWindows,
      `${label} timing must have two confirmation windows`,
    );
    const sustainedMedian = windows.every((window) => window.medianMs > limits.medianMs);
    const sustainedP95 = windows.every((window) => window.p95Ms > limits.p95Ms);
    evidence.timingGate[label] = { baseline, limits, windows, sustainedMedian, sustainedP95 };
    assert.equal(
      sustainedMedian || sustainedP95,
      false,
      `${label} sustained frame-time regression exceeded the matched baseline budget`,
    );
  }

  const high = evidence.scenarios.find((scenario) => scenario.quality === "high");
  assert.ok(
    high.render.calls <= 41,
    `normal scene draw calls regressed above revision-32 baseline: ${high.render.calls}`,
  );
  assert.ok(
    evidence.channelCut.render.calls <= 42,
    `channel scene draw calls regressed above revision-32 baseline: ${evidence.channelCut.render.calls}`,
  );
  assert.ok(high.memory.geometries <= 25);
  assert.ok(high.memory.textures <= 6);

  // Long-session stability window: same low-quality scene, no reload, enough frames for
  // adaptive/weather/wildlife systems to cycle while renderer resources must remain flat.
  await page.click("#settings-toggle");
  await page.selectOption("#quality", "low");
  await page.click("#settings-toggle");
  await page.evaluate(() => {
    const g = window.__SF;
    Object.assign(g.body, {
      x: -10,
      z: 18,
      y: g.state.sampleHeight(-10, 18),
      vx: 0,
      vy: 0,
      vz: 0,
      mode: "land",
      grounded: true,
    });
    g.rig.initial = true;
    g.loop.frames.length = 0;
  });
  await page.waitForFunction(
    () => {
      const chunks = window.__SF.streaming.stats();
      return chunks.active === 9 && chunks.queued === 0;
    },
    null,
    { timeout: 60000 },
  );
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__SF.loop.frames.length = 0;
  });
  const stabilityStart = await page.evaluate(() => {
    const s = window.__SF.stats();
    return {
      memory: s.memory,
      chunks: s.chunks,
      heap: performance.memory?.usedJSHeapSize ?? null,
      performance: s.performance,
    };
  });
  await page.waitForFunction(
    () => window.__SF.loop.frames.length >= 360,
    null,
    { timeout: 120000 },
  );
  evidence.stability = await page.evaluate((start) => {
    const g = window.__SF,
      s = g.stats(),
      frames = s.frames,
      summarize = (slice) => {
        const f = slice.slice().sort((a, b) => a - b);
        return {
          samples: f.length,
          medianMs: f[Math.floor(f.length * 0.5)],
          p95Ms: f[Math.floor(f.length * 0.95)],
          p99Ms: f[Math.min(f.length - 1, Math.floor(f.length * 0.99))],
          maxMs: f.at(-1),
        };
      };
    return {
      first: summarize(frames.slice(20, 160)),
      last: summarize(frames.slice(-140)),
      start,
      end: {
        memory: s.memory,
        chunks: s.chunks,
        heap: performance.memory?.usedJSHeapSize ?? null,
        performance: s.performance,
      },
    };
  }, stabilityStart);
  assert.equal(evidence.stability.start.chunks.active, 9);
  assert.equal(evidence.stability.start.chunks.queued, 0);
  assert.equal(evidence.stability.end.chunks.active, 9);
  assert.equal(evidence.stability.end.chunks.queued, 0);
  assert.deepEqual(
    evidence.stability.end.memory,
    evidence.stability.start.memory,
    "steady play must not accumulate renderer geometries/textures after streaming settles",
  );
  if (
    evidence.stability.start.heap !== null &&
    evidence.stability.end.heap !== null
  )
    assert.ok(
      evidence.stability.end.heap <= evidence.stability.start.heap + 8_000_000,
      "steady-play JS heap grew beyond the bounded stability allowance",
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
