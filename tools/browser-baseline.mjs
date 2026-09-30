// Actual renderer evidence only. Requires a separately running server and installed Chromium.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
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
 const samples = [];
 for (let i = 0; i < 24; i++) {
  await page.click('#cycle');
  await page.waitForFunction(() => window.__SF.streaming.stats().queued === 0);
  samples.push(await page.evaluate(() => window.__SF.stats()));
 }
 for (const sample of samples) {
  assert.equal(sample.chunks.active, 9);
  assert.equal(sample.memory.geometries, initial.memory.geometries);
  assert.equal(sample.memory.textures, initial.memory.textures);
 }
 await page.screenshot({ path: 'artifacts/phase0-terrain.png' });
 const report = { environment: 'Headless Chromium / software rendering; not mobile or hardware performance evidence', bootMs, initial, samples, errors };
 await writeFile('artifacts/phase0-browser.json', JSON.stringify(report, null, 2));
 assert.deepEqual(errors, []);
 console.log('Browser baseline completed; screenshot still requires rendered inspection.');
} finally { await browser.close(); }
