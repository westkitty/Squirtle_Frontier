// Production-bundle validation: vite build, then a static preview server, never the dev module graph.
import { launchBrowser } from "./browser-launch.mjs";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
};
const root = new URL("../dist", import.meta.url).pathname;
const server = createServer(async (req, res) => {
  try {
    const path = join(
      root,
      decodeURIComponent(req.url.split("?")[0]).replace(/\/$/, "/index.html"),
    );
    res.setHeader(
      "content-type",
      types[extname(path)] || "application/octet-stream",
    );
    res.end(await readFile(path));
  } catch {
    res.statusCode = 404;
    res.end("missing");
  }
});
await new Promise((r) => server.listen(4173, "0.0.0.0", r));
const browser = await launchBrowser(),
  evidence = { errors: [], requested: [] };
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  page.on("pageerror", (e) => evidence.errors.push(e.message));
  page.on(
    "console",
    (m) => m.type() === "error" && evidence.errors.push(m.text()),
  );
  page.on("request", (r) => evidence.requested.push(new URL(r.url()).pathname));
  await page.goto("http://127.0.0.1:4173/");
  await page.waitForFunction(() => window.__SF?.loop.frames.length > 30, null, {
    timeout: 30000,
  });
  evidence.devGraph = evidence.requested.filter(
    (p) => p.startsWith("/src/") || p.includes("vite/client"),
  );
  assert.deepEqual(
    evidence.devGraph,
    [],
    "built bundle must not load the dev module graph",
  );
  evidence.bundle = evidence.requested.filter((p) => p.startsWith("/assets/"));
  assert.ok(evidence.bundle.some((p) => p.endsWith(".js")));
  const before = await page.evaluate(() => ({ ...window.__SF.body }));
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(700);
  await page.keyboard.up("KeyW");
  evidence.movedMeters = await page.evaluate(
    (b) => Math.hypot(window.__SF.body.x - b.x, window.__SF.body.z - b.z),
    before,
  );
  // Software rendering supplies ~8 frames in this window, so distance is small.
  assert.ok(
    evidence.movedMeters > 0.3,
    `direct movement in built bundle ${evidence.movedMeters}`,
  );
  evidence.savedPosition = await page.evaluate(() => {
    window.__SF.state.player = { x: window.__SF.body.x, z: window.__SF.body.z };
    window.__SF.state.frontier.bypass = 0.6;
    window.__SF.savedX = window.__SF.body.x;
    return { x: window.__SF.body.x, z: window.__SF.body.z };
  });
  await page.click("#settings-toggle");
  await page.click("#save");
  await page.waitForFunction(() => {
    const raw = localStorage.getItem("squirtle_frontier_baseline_v1");
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return (
      parsed.frontier.bypass === 0.6 &&
      Math.abs(parsed.player.x - window.__SF.savedX) < 0.01
    );
  });
  await page.reload();
  await page.waitForFunction(() => window.__SF?.loop.frames.length > 20);
  evidence.afterReload = await page.evaluate(() => ({
    x: +window.__SF.body.x.toFixed(3),
    z: +window.__SF.body.z.toFixed(3),
    bypass: window.__SF.state.frontier.bypass,
    stage: window.__SF.state.frontier.stage,
    assets: window.__SF.stats().assets,
  }));
  assert.ok(
    Math.abs(evidence.afterReload.x - evidence.savedPosition.x) < 0.35,
    JSON.stringify({
      reloaded: evidence.afterReload.x,
      saved: evidence.savedPosition.x,
    }),
  );
  assert.equal(evidence.afterReload.bypass, 0.6);
  assert.equal(
    evidence.afterReload.assets.references,
    1,
    "Squirtle asset stays cached in the built app",
  );
  await page.evaluate(() => window.__SF.dispose());
  evidence.teardown = await page.evaluate(() => ({
    ...window.__SF.renderer.info.memory,
  }));
  assert.deepEqual(evidence.teardown, { geometries: 0, textures: 0 });
  assert.deepEqual(evidence.errors, []);
  await page.screenshot({ path: "artifacts/dist-built.png" });
  console.log(
    "Built bundle boots from static hosting with direct movement, persistence, cached asset and zero-resource teardown.",
  );
} finally {
  await writeFile(
    "docs/qa/dist-browser.json",
    JSON.stringify(evidence, null, 2),
  );
  await browser.close();
  server.close();
}
