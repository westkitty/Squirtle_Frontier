// Representative-state visual capture. Requires a running server and installed Chromium.
// Purely observational: it never mutates the world beyond positioning the test camera.
import { launchBrowser } from './browser-launch.mjs';
import { mkdir } from 'node:fs/promises';
const out = process.env.OUT_DIR || 'artifacts/visual';
await mkdir(out, { recursive: true });
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__SF?.streaming.stats().queued === 0);
  await page.waitForFunction(() => window.__SF.loop.frames.length >= 90);

  const settle = async (x, z, yaw = 0, ms = 900) => {
    await page.evaluate(([x, z, yaw]) => {
      const sf = window.__SF;
      sf.body.x = x; sf.body.z = z; sf.body.y = 2.2;
      sf.body.vx = sf.body.vy = sf.body.vz = 0;
      sf.body.yaw = yaw;
      if (sf.rig) sf.rig.initial = true;
    }, [x, z, yaw]);
    await page.waitForTimeout(ms);
    await page.waitForFunction(() => window.__SF.streaming.stats().queued === 0);
    await page.waitForTimeout(400);
  };
  const shot = async (name) => { await page.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };

  // 1. Arrival / spawn state
  await shot('01-arrival');
  // 2. Waterside
  await settle(-4, 12, 2.4);
  await shot('02-waterside');
  // 3. In water (basin)
  await page.evaluate(() => {
    const sf = window.__SF;
    sf.body.x = -2; sf.body.z = -2; sf.body.y = -0.35;
    sf.body.mode = 'swim'; sf.body.vx = 1.2; sf.body.vz = 0.4;
    sf.rig.initial = true;
  });
  await page.waitForTimeout(1200);
  await shot('03-swim');
  // 4. Dive
  await page.evaluate(() => {
    const sf = window.__SF;
    sf.body.y = -2.4; sf.body.mode = 'dive'; sf.rig.initial = true;
  });
  await page.waitForTimeout(1200);
  await shot('04-dive');
  // 5. Settlement
  await settle(-11, -7, 0.6);
  await shot('05-settlement');
  // 6. Lab basin
  await page.evaluate(() => { window.__SF.enterPlace('lab'); });
  await page.waitForTimeout(1600);
  await shot('06-lab');
  // 7. Deep Record
  await page.evaluate(() => { window.__SF.enterPlace('record'); window.__SF.body.y = -6; });
  await page.waitForTimeout(1600);
  await shot('07-record');
  // 8. Memory panel
  await page.evaluate(() => { window.__SF.enterPlace('frontier'); });
  await page.waitForTimeout(900);
  await page.click('#memory-toggle');
  await page.waitForTimeout(400);
  await shot('08-memory-panel');
  await page.keyboard.press('Escape');
  // 9. Controls panel
  await page.click('#help-toggle');
  await page.waitForTimeout(300);
  await shot('09-help-panel');
  await page.keyboard.press('Escape');
  // 10. Sense
  await settle(-2, 4, 1.2);
  await page.keyboard.down('KeyF');
  await page.waitForTimeout(1400);
  await shot('10-sense');
  await page.keyboard.up('KeyF');
  console.log('errors', JSON.stringify(errors));
  if (errors.length) process.exitCode = 1;
} finally { await browser.close(); }
