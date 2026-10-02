// Locomotion Zero, stage 6 in the browser: the water surface has to be crossed
// without a strobe, and a window resize has to be absorbed without a flash.
//
// Both are measured as frame series, because "flash" is not a state you can read off
// at one moment - it is a large change between two consecutive frames that the player
// did not ask for. Evidence lands in docs/qa/locomotion-visual-browser.json.
import { launchBrowser } from "./browser-launch.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

// One rAF sample per frame, taken inside the page: a flash is a difference between two
// consecutive frames, so it has to be measured there.
async function sample(frames) {
  const out = [];
  for (let i = 0; i < frames; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    const g = window.__SF;
    out.push({
      ...g.water(),
      density: g.scene.fog.density,
      color: g.scene.fog.color.getHex(),
      ratio: g.renderer.getPixelRatio(),
      resize: g.resize().applied,
      scale: g.adaptive.value,
      bodyY: g.body.y,
      level: g.state.waterLevel,
    });
  }
  return out;
}

await mkdir("docs/qa", { recursive: true });
const browser = await launchBrowser();
const errors = [],
  evidence = {
    environment:
      "Chromium 140 / ANGLE SwiftShader; frame timing here is not hardware or mobile performance evidence",
  };
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
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
  await page.evaluate(() => document.querySelector("canvas").focus());

  // Walk to the water and stop in it, physically. No teleport: the point is what
  // happens while the body rides the surface.
  await page.keyboard.down("KeyD");
  await page.waitForFunction(
    () => window.__SF.body.mode === "wade" || window.__SF.body.mode === "swim",
    null,
    { timeout: 30000 },
  );
  await page.keyboard.up("KeyD");
  await new Promise((r) => setTimeout(r, 700));
  const shoreline = await page.evaluate(sample, 90);
  const flips = (series) =>
    series.reduce(
      (n, f, i) => n + (i && f.underwater !== series[i - 1].underwater ? 1 : 0),
      0,
    );
  const maxStep = (series, key) =>
    series.reduce(
      (m, f, i) => (i ? Math.max(m, Math.abs(f[key] - series[i - 1][key])) : 0),
      0,
    );
  evidence.shoreline = {
    frames: shoreline.length,
    stateFlips: flips(shoreline),
    maxDensityStep: +maxStep(shoreline, "density").toFixed(5),
    maxColorStep: +maxColorStep(shoreline).toFixed(2),
    mixRange: [
      Math.min(...shoreline.map((f) => f.mix)),
      Math.max(...shoreline.map((f) => f.mix)),
    ],
  };
  assert.equal(
    flips(shoreline),
    0,
    `standing in the shallows flipped the water state ${flips(shoreline)} times in 90 frames`,
  );
  assert.ok(
    evidence.shoreline.maxDensityStep < 0.004,
    `fog density jumped ${evidence.shoreline.maxDensityStep} between two frames while nothing was asked for`,
  );
  assert.ok(
    evidence.shoreline.mixRange[1] < 0.02,
    "the camera was treated as submerged while standing in the shallows",
  );

  // Cross the surface somewhere there is actually depth to cross into. The Lab basin
  // is the deterministic one: a built bowl 1.2 m deep, entered through its own door
  // (a place change, which is a teleport by admission - the crossing itself is not).
  await page.evaluate(() => {
    window.__SF.enterPlace("lab");
    // The view's yaw is aimed inward so that walking forward goes into the basin;
    // the body itself is only ever moved by the key.
    window.__SF.rig.yaw = Math.PI;
  });
  await page.keyboard.down("KeyW");
  await page.waitForFunction(() => window.__SF.body.mode === "swim", null, {
    timeout: 25000,
  });
  await page.keyboard.up("KeyW");
  const box = await page.evaluate(() => {
    const r = document.querySelector("canvas").getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  // Look up so the boom brings the eye down through the plane, then dive with the key.
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x, box.y - 240, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.down("KeyQ");
  // Sampled while the crossing happens, not after it: a strobe only shows up as a
  // frame-to-frame series that straddles the surface.
  const diving = await page.evaluate(sample, 130);
  await page.waitForFunction(() => window.__SF.body.y < -1.05, null, {
    timeout: 25000,
  });
  const deep = await page.evaluate(() => ({
    body: window.__SF.body.y,
    mode: window.__SF.body.mode,
    ...window.__SF.water(),
    density: window.__SF.scene.fog.density,
  }));
  evidence.deep = {
    body: +deep.body.toFixed(3),
    mode: deep.mode,
    underwater: deep.underwater,
    density: +deep.density.toFixed(4),
  };
  assert.ok(
    deep.underwater,
    `on the basin floor the camera state still insisted on being dry (body y ${deep.body.toFixed(2)}, mode ${deep.mode})`,
  );
  assert.ok(deep.density > 0.09, `submerged fog stayed at ${deep.density}`);
  await page.screenshot({ path: "artifacts/underwater.png" });

  // Surface again with the Rise key.
  await page.keyboard.up("KeyQ");
  await page.keyboard.down("KeyE");
  await page.waitForFunction(() => window.__SF.body.mode === "swim", null, {
    timeout: 30000,
  });
  await page.keyboard.up("KeyE");
  // Level the view before expecting the eye to be dry: a look-up boom deliberately
  // keeps the camera low, and the state has to follow where the camera actually is.
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x, box.y + 240, { steps: 12 });
  await page.mouse.up();
  const surfacing = await page.evaluate(sample, 90);
  evidence.surfacing = {
    stateFlips: flips(surfacing),
    maxDensityStep: +maxStep(surfacing, "density").toFixed(5),
    endDensity: +surfacing.at(-1).density.toFixed(4),
  };
  assert.ok(
    evidence.surfacing.maxDensityStep < 0.006,
    "coming up cut instead of easing",
  );
  assert.ok(evidence.surfacing.endDensity < 0.05, "the view never cleared");

  // A resize burst: twelve viewport changes inside one frame's worth of wall clock.
  // Requests must coalesce, the canvas must keep its CSS box, and the pixel budget
  // must stay inside the documented limits.
  const FINAL = [1024, 640],
    before = await page.evaluate(() => window.__SF.resize().applied);
  for (const [width, height] of [
    [900, 600],
    [880, 590],
    [920, 610],
    [700, 500],
    [1024, 640],
    [1023, 639],
    [800, 600],
    [801, 601],
    [960, 540],
    [961, 541],
    [1000, 700],
    [900, 600],
    // End on a different box than it started, so the burst has to produce a real
    // change - coalescing is only meaningful if something was actually applied.
    [1024, 640],
  ]) {
    await page.setViewportSize({ width, height });
  }
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => r())),
  );
  const after = await page.evaluate(() => ({
    applied: window.__SF.resize().applied,
    css: (() => {
      const canvas = document.querySelector("canvas");
      return {
        inline: canvas.style.width + "|" + canvas.style.height,
        rendered: [
          Math.round(canvas.getBoundingClientRect().width),
          Math.round(canvas.getBoundingClientRect().height),
        ],
      };
    })(),
    buffer: [
      window.__SF.renderer.domElement.width,
      window.__SF.renderer.domElement.height,
    ],
    ratio: window.__SF.renderer.getPixelRatio(),
    size: window.__SF.resize().size,
  }));
  evidence.resize = {
    requests: 13,
    reallocations: after.applied - before,
    ...after,
  };
  assert.ok(
    after.applied - before <= 2,
    `${after.applied - before} framebuffer reallocations for a 12-event burst`,
  );
  assert.equal(
    after.css.inline,
    "|",
    "the pump must not write inline canvas sizes",
  );
  assert.deepEqual(
    after.css.rendered,
    FINAL,
    "CSS owns the canvas box, and followed it",
  );
  assert.ok(
    after.ratio > 0,
    "a zero pixel ratio would flash to a blank canvas",
  );
  assert.equal(
    after.buffer[0],
    Math.floor(FINAL[0] * after.ratio),
    "the buffer must match the size the box has",
  );
  assert.ok(
    after.applied - before >= 1,
    "a burst that changes the box has to be applied once, not never",
  );
  await writeFile(
    "docs/qa/locomotion-visual-browser.json",
    JSON.stringify({ ...evidence, errors }, null, 2),
  );
  assert.deepEqual(errors, [], "the page reported errors");
  console.log(
    `\nShoreline calm (${evidence.shoreline.stateFlips} state flips, ${evidence.shoreline.maxDensityStep} max density step), one crossing down and up, ${evidence.resize.reallocations} reallocation(s) for 12 resize events, and no inline canvas sizing passed. Human perception of flicker remains unverified.`,
  );
} finally {
  await browser.close();
}

function maxColorStep(series) {
  let m = 0;
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1].color,
      b = series[i].color;
    m = Math.max(
      m,
      Math.abs(((a >> 16) & 255) - ((b >> 16) & 255)) +
        Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)) +
        Math.abs((a & 255) - (b & 255)),
    );
  }
  return m;
}
