// Matched-camera proof that the visible shoreline answers to the basin's level.
//
// Every shot is taken from the identical camera pose and identical body state; the only
// thing that differs between the three is the wetland node, which is the number a repair
// actually moves. Before the pond surface was resolved from the movement predicate, all
// three images were the same picture at three different levels.
import { launchBrowser } from './browser-launch.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { WATER_BASE, WATER_FULL_RISE, WATER_DRY_DROP } from '../src/simulation/water-level.js';

const out = process.env.OUT_DIR || 'artifacts/shoreline';
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

  // A fixed bank pose looking across the basin, so the shoreline is the whole subject.
  await page.evaluate(([x, z, yaw]) => {
    const sf = window.__SF;
    sf.body.x = x; sf.body.z = z; sf.body.y = -0.05;
    sf.body.vx = sf.body.vy = sf.body.vz = 0;
    sf.body.yaw = yaw;
    sf.rig.initial = true;
  }, [-2, 20, 3.1]);
  await page.waitForTimeout(1500);

  // Fixture: the level is derived from the wetland node, which needs real minutes of the
  // one-second regional tick to converge. Holding that single node is the same kind of
  // seeded condition the performance harness uses; body, camera, weather, terrain and
  // every other node are untouched, and the hold is released between shots.
  await page.evaluate(() => {
    const sf = window.__SF;
    window.__holdWetland = null;
    const tick = () => {
      if (window.__holdWetland !== null)
        sf.state.watershed.nodes.find((n) => n.id === 'wetland').wetness =
          window.__holdWetland;
      requestAnimationFrame(tick);
    };
    tick();
  });

  const rows = [];
  for (const [name, target, wetness] of [
    ['level-low', WATER_BASE - WATER_DRY_DROP, 0],
    ['level-base', WATER_BASE, 0.05],
    ['level-full', WATER_BASE + WATER_FULL_RISE, 1],
  ]) {
    await page.evaluate((w) => {
      window.__holdWetland = w;
      window.__SF.rig.initial = true;
    }, wetness);
    await page.waitForTimeout(1400);
    const measured = await page.evaluate(() => {
      const sf = window.__SF;
      // Measure the rendered outline through the same predicate the body swims by, from
      // the same centre and the same sixteen directions, at whatever level is live now.
      const spokes = [];
      for (let s = 0; s < 16; s++) {
        const a = (s / 16) * Math.PI * 2;
        let last = 0;
        for (let r = 0.25; r <= 33; r += 0.25)
          if (sf.region.water(Math.cos(a) * r, Math.sin(a) * r, sf.state.waterLevel))
            last = r;
        spokes.push(+last.toFixed(2));
      }
      return {
        level: +sf.state.waterLevel.toFixed(3),
        centreRadius: +spokes[0].toFixed(2),
        longAxisRadius: +spokes[4].toFixed(2),
        spokes,
      };
    });
    await page.screenshot({ path: `${out}/${name}.png` });
    rows.push({ name, target: +target.toFixed(3), ...measured });
    console.log(name, JSON.stringify(measured));
  }
  await page.evaluate(() => { window.__holdWetland = null; });
  const grew = rows[2].longAxisRadius - rows[0].longAxisRadius;
  console.log('long-axis shoreline moved', grew.toFixed(2), 'm between low and full');
  await writeFile(`${out}/outline.json`, JSON.stringify({ rows, grew, errors }, null, 2) + '\n');
  if (errors.length) process.exitCode = 1;
} finally { await browser.close(); }
