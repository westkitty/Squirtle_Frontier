// Actual renderer evidence only. Requires a separately running server and installed Chromium.
import { launchBrowser } from './browser-launch.mjs';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('artifacts', { recursive: true });
const browser = await launchBrowser();
try {
 const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
 const errors = [];
 page.on('pageerror', e => errors.push(e.message));
 page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
 const start = performance.now();
 await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5173');
 await page.waitForFunction(() => window.__SF?.streaming.stats().queued === 0);
 const bootMs = performance.now() - start;
 await page.waitForFunction(() => window.__SF.loop.frames.length >= 120);
 const initial = await page.evaluate(() => window.__SF.stats());
 const samples = [], checkpoints = [];
 await page.screenshot({ path: 'artifacts/phase0-terrain.png' });
 for (let i = 0; i < 24; i++) {
  await page.click('#cycle');
  await page.waitForFunction(() => window.__SF.streaming.stats().queued === 0);
  samples.push(await page.evaluate(() => window.__SF.stats()));
  if (i % 6 === 5) {
   await page.evaluate(() => { window.__SF.state.player.x = -140; window.__SF.state.player.z = 306; });
   await page.waitForFunction(() => window.__SF.streaming.chunks.center.i === -1 && window.__SF.streaming.stats().queued === 0);
   checkpoints.push(await page.evaluate(() => window.__SF.stats()));
  }
 }
 for (const sample of samples) {
  assert.equal(sample.chunks.active, 9);
  assert.ok(sample.memory.geometries <= 9, 'no more uploaded geometries than owned chunks');
  assert.equal(sample.memory.textures, initial.memory.textures);
 }
 for (const sample of checkpoints) assert.deepEqual(sample.memory, initial.memory);
 const frames = initial.frames.slice(10).sort((a,b) => a-b);
 const frameTiming = { samples: frames.length, medianMs: frames[Math.floor(frames.length * .5)], p95Ms: frames[Math.floor(frames.length * .95)] };
 const heap = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
 const report = { environment: 'Headless Chromium / software rendering; not mobile or hardware performance evidence', bootMs, frameTiming, heap, initial, samples, checkpoints, errors };
 await writeFile('artifacts/phase0-browser.json', JSON.stringify(report, null, 2));
 assert.deepEqual(errors, []);
 console.log('Browser baseline completed; screenshot still requires rendered inspection.');
} finally { await browser.close(); }
