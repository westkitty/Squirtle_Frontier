// Controlled software-renderer experiment, not a gameplay or hardware FPS gate.
// Uses the app's existing loop. gl.finish() is diagnostic-only and never shipped.
import { launchBrowser } from "./browser-launch.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await launchBrowser();
const report = {
  date: new Date().toISOString(),
  environment:
    "Sandbox Chromium / SwiftShader; forced GPU synchronization diagnostic",
  runs: [],
};
const configurations = [
  { name: "clear-only", aa: false, scale: 1, clear: true },
  { name: "scene-aa", aa: true, scale: 1 },
  { name: "scene-no-aa", aa: false, scale: 1 },
  { name: "quarter-pixels", aa: false, scale: 0.5 },
];
try {
  for (let repeat = 0; repeat < 2; repeat++)
    for (const config of configurations) {
      const page = await browser.newPage({
        viewport: { width: 960, height: 640 },
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/src/main.js", async (route) => {
        const response = await route.fetch();
        let body = await response.text();
        body = body.replace(
          /antialias: (?:true|false),/,
          `antialias: ${config.aa},`,
        );
        await route.fulfill({ response, body });
      });
      await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
      await page.waitForFunction(() => window.__SF?.loop.frames.length > 15);
      await page.evaluate((config) => {
        const g = window.__SF,
          render = g.renderer.render.bind(g.renderer),
          update = g.loop.update.bind(g.loop),
          gl = g.renderer.getContext();
        g.renderer.setPixelRatio(config.scale);
        window.__diagnostic = {
          samples: [],
          update: 0,
          antialias: gl.getContextAttributes().antialias,
        };
        g.loop.update = (dt) => {
          const start = performance.now();
          update(dt);
          window.__diagnostic.update += performance.now() - start;
        };
        g.renderer.render = (scene, camera) => {
          const d = window.__diagnostic,
            start = performance.now();
          if (config.clear) g.renderer.clear();
          else render(scene, camera);
          const submit = performance.now();
          gl.finish();
          const finished = performance.now();
          d.samples.push({
            update: d.update,
            submit: submit - start,
            finish: finished - submit,
            wall: d.last ? finished - d.last : 0,
          });
          d.update = 0;
          d.last = finished;
        };
      }, config);
      await page.waitForFunction(
        () => window.__diagnostic.samples.length >= 70,
        null,
        { timeout: 60000 },
      );
      const data = await page.evaluate(() => {
        const d = window.__diagnostic,
          samples = d.samples.slice(10);
        const result = { antialias: d.antialias, samples: samples.length };
        for (const key of ["update", "submit", "finish", "wall"]) {
          const values = samples.map((s) => s[key]).sort((a, b) => a - b);
          result[key] = {
            medianMs: values[Math.floor(values.length * 0.5)],
            p95Ms: values[Math.floor(values.length * 0.95)],
          };
        }
        return result;
      });
      assert.equal(data.antialias, config.aa);
      assert.deepEqual(errors, []);
      report.runs.push({ repeat, ...config, ...data });
      console.log(JSON.stringify(report.runs.at(-1)));
      await page.close();
    }
} finally {
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/render-diagnostic.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}
