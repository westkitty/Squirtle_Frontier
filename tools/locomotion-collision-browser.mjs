// Locomotion Zero, stage 8 in the browser: contact response, and a world whose limit is
// the terrain rather than a prototype box.
//
// The node suite owns the arithmetic. What only a running app can answer is whether the
// real loop, with the real cached colliders and the real terrain, ever lets the body
// inside an obstruction, whether a hit shows up in the feedback the page renders, and
// whether a save written far from spawn comes back far from spawn instead of at the
// door. Evidence lands in docs/qa/locomotion-collision-browser.json.
import { launchBrowser } from "./browser-launch.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { PLAYABLE_BOUND, heightAt } from "../src/worldgen.js";
import { CONTACT } from "../src/player/locomotion-states.js";

// One sample per animation frame, taken inside the page. `gap` is the body's clearance
// from the nearest collider the step was allowed to consider -- negative means the
// simulation put the body inside something. Everything this function touches has to be
// passed in or read off the page: it is serialized, so it cannot close over this module.
const SAMPLER = async ({ ms, keys, bodyRadius }) => {
  const g = window.__SF;
  for (const k of keys) g.input.keys.add(k);
  const out = [];
  const start = performance.now();
  let last = start,
    previous = null;
  while (performance.now() - start < ms) {
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now(),
      b = g.body,
      cell = g.region.obstaclesAt(b.x, b.z);
    let gap = Infinity;
    for (const o of cell) {
      const base = g.region.sample(o.x, o.z).height,
        crown = base + o.height;
      if (b.y + bodyRadius <= base || b.y - bodyRadius >= crown) continue;
      gap = Math.min(gap, Math.hypot(b.x - o.x, b.z - o.z) - o.radius);
    }
    const step = previous ? Math.hypot(b.x - previous.x, b.z - previous.z) : 0;
    previous = { x: b.x, z: b.z };
    out.push({
      x: +b.x.toFixed(4),
      z: +b.z.toFixed(4),
      y: +b.y.toFixed(4),
      speed: +Math.hypot(b.vx, b.vz).toFixed(3),
      step: +step.toFixed(3),
      dt: +(now - last).toFixed(1),
      gap: gap === Infinity ? null : +gap.toFixed(4),
      impact: +b.impact.toFixed(4),
      distance: +b.distance.toFixed(3),
      mode: b.mode,
      hudSpeed: (document.querySelector("#speed")?.textContent ?? "").trim(),
    });
    last = now;
  }
  for (const k of keys) g.input.keys.delete(k);
  return out;
};

const finite = (xs) => xs.filter((v) => v !== null && Number.isFinite(v));
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const p95 = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : 0;
};

await mkdir("docs/qa", { recursive: true });
const browser = await launchBrowser();
const errors = [],
  evidence = {
    environment:
      "Chromium 140 / ANGLE SwiftShader; frame timing here is software rendering, not hardware or mobile performance",
    bound: PLAYABLE_BOUND,
    contact: { ...CONTACT },
    scriptedSetup:
      "blocks 2 and 3 place the body once (position and velocity); every later value is the simulation's own",
  };

try {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
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

  // 1. Eight seconds of running across real ground, sampled every frame.
  const run = await page.evaluate(SAMPLER, {
    ms: 8000,
    keys: ["KeyW", "ShiftLeft"],
    bodyRadius: CONTACT.bodyRadius,
  });
  const gaps = finite(run.map((s) => s.gap)),
    steps = finite(run.map((s) => s.step)),
    travelled = run[run.length - 1].distance - run[0].distance;
  assert.ok(run.length > 12, `only ${run.length} frames were sampled`);
  assert.ok(
    gaps.every((g) => g >= -1e-6),
    `the body was inside a collider by up to ${Math.min(...gaps).toFixed(3)} m`,
  );
  assert.ok(
    Math.max(...steps) < 4,
    `a single frame moved the body ${Math.max(...steps).toFixed(2)} m -- that is a teleport, not a step`,
  );
  assert.ok(
    travelled > 15,
    `the run only covered ${travelled.toFixed(1)} m in 8 s`,
  );
  assert.ok(
    run.every(
      (s) =>
        Math.abs(s.x) < PLAYABLE_BOUND + 1 &&
        Math.abs(s.z) < PLAYABLE_BOUND + 1,
    ),
    "the body left the world",
  );
  evidence.run = {
    samples: run.length,
    metresTravelled: +travelled.toFixed(1),
    largestFrameStep: +Math.max(...steps).toFixed(2),
    medianFrameMs: median(run.map((s) => s.dt)),
    p95FrameMs: p95(run.map((s) => s.dt)),
    worstClearanceViolation: +Math.min(0, ...gaps).toFixed(4),
    framesWithin2cmOfACollider: gaps.filter((g) => g < 0.02).length,
    maxImpact: Math.max(...run.map((s) => s.impact)),
  };

  // 2. A scripted arrival at a tree the region really reports, rather than a walk that
  //    happens to brush one. Position and velocity are set; the response is the sim's.
  const arrival = await page.evaluate(
    async ({ chunk, approach }) => {
      const g = window.__SF,
        b = g.body,
        origin = { x: b.x, z: b.z };
      let tree = null;
      for (let cx = -3; cx <= 3 && !tree; cx++)
        for (let cz = -3; cz <= 3 && !tree; cz++) {
          const list = g.region.obstaclesAt(
            origin.x + cx * chunk,
            origin.z + cz * chunk,
          );
          if (list.length) tree = list[0];
        }
      if (!tree) return { missing: true };
      b.x = tree.x;
      b.z = tree.z - (tree.radius + approach);
      b.y = g.region.sample(b.x, b.z).height;
      b.yaw = 0;
      b.vx = 0;
      b.vy = 0;
      b.vz = 11; // the top of run speed, straight at it
      b.impact = 0;
      // No keys are held: the drive is camera-relative, and the point of this block is the
      // contact, so the arrival is the body's own momentum along the yaw it was given.
      const out = [];
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        const d = Math.hypot(b.x - tree.x, b.z - tree.z);
        out.push({
          gap: +(d - tree.radius).toFixed(4),
          impact: +b.impact.toFixed(4),
          speed: +Math.hypot(b.vx, b.vz).toFixed(3),
          hudSpeed: (
            document.querySelector("#speed")?.textContent ?? ""
          ).trim(),
        });
      }
      return {
        tree: {
          x: +tree.x.toFixed(2),
          z: +tree.z.toFixed(2),
          radius: tree.radius,
        },
        out,
      };
    },
    { chunk: 24, approach: 0.6 },
  );
  assert.ok(
    !arrival.missing,
    "no tree collider was reported anywhere near the body",
  );
  evidence.arrivalTrace = arrival.out.filter((_, i) => i % 6 === 0);
  const peakImpact = Math.max(...arrival.out.map((s) => s.impact)),
    overlap = Math.min(...arrival.out.map((s) => s.gap)),
    finalSpeed = arrival.out[arrival.out.length - 1].speed;
  assert.ok(
    overlap >= -1e-6,
    `the arrival ended ${(-overlap).toFixed(3)} m inside a tree (radius ${arrival.tree.radius})`,
  );
  assert.ok(
    peakImpact > 0.1,
    `a head-on hit registered impact ${peakImpact} (min gap ${overlap.toFixed(3)} m)`,
  );
  assert.ok(peakImpact <= 1, `impact overshot full strength (${peakImpact})`);
  const peakSpeed = Math.max(...arrival.out.map((s) => s.speed));
  assert.ok(
    finalSpeed <= peakSpeed + 1e-6,
    `the body left the contact faster than it ever arrived (${finalSpeed} > ${peakSpeed})`,
  );
  assert.ok(
    arrival.out.some((s) => s.gap >= CONTACT.bodyRadius - 0.05),
    "the body was never separated from the tree",
  );
  evidence.arrival = {
    traceRecorded: true,
    tree: { ...arrival.tree, standOff: CONTACT.bodyRadius },
    peakImpact: +peakImpact.toFixed(3),
    minGap: +overlap.toFixed(4),
    framesSampled: arrival.out.length,
    peakSpeedDuringContact: +peakSpeed.toFixed(3),
    speedAfter: finalSpeed,
  };

  // 3. The rim. The body is placed just inside the limit and left to press outward: the
  //    position stops, the velocity stops being pushed into it, and the readout stops
  //    crediting travel that never happened.
  const rim = await page.evaluate(
    async ({ bound }) => {
      const g = window.__SF,
        b = g.body;
      b.x = 0;
      b.z = bound - 3;
      b.y = g.region.sample(b.x, b.z).height;
      b.yaw = 0;
      b.vx = 0;
      b.vz = 9;
      b.distance = 0;
      const out = [];
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        out.push({
          x: +b.x.toFixed(4),
          z: +b.z.toFixed(4),
          vz: +b.vz.toFixed(4),
          speed: +Math.hypot(b.vx, b.vz).toFixed(4),
          distance: +b.distance.toFixed(4),
          hud: (document.querySelector("#speed")?.textContent ?? "").trim(),
        });
      }
      return out;
    },
    { bound: PLAYABLE_BOUND },
  );
  const tails = rim.slice(-40),
    jitter =
      Math.max(...tails.map((s) => s.z)) - Math.min(...tails.map((s) => s.z)),
    credited = tails[tails.length - 1].distance - tails[0].distance,
    outwardTail = Math.max(...tails.map((s) => Math.abs(s.vz)));
  assert.ok(
    rim.every((s) => s.z <= PLAYABLE_BOUND + 1e-6),
    `the body crossed the rim (max z ${Math.max(...rim.map((s) => s.z)).toFixed(2)})`,
  );
  assert.ok(
    outwardTail < 0.05,
    `outward velocity survived the boundary (${outwardTail.toFixed(3)})`,
  );
  assert.ok(
    jitter < 0.02,
    `the body jittered ${jitter.toFixed(3)} m against the rim`,
  );
  assert.ok(
    credited < 0.05,
    `the blocked push was credited with ${credited.toFixed(2)} m of travel`,
  );
  const hudNumbers = finite(tails.map((s) => parseFloat(s.hud)));
  assert.ok(
    hudNumbers.length === 0 || Math.max(...hudNumbers) < 0.6,
    `the speed readout still reported ${Math.max(...hudNumbers)} while the body could not move`,
  );
  evidence.rim = {
    bound: PLAYABLE_BOUND,
    terrainHeightAtBound: +heightAt(0, PLAYABLE_BOUND).toFixed(1),
    terrainHeightTwoHundredBeyond: +heightAt(0, PLAYABLE_BOUND + 200).toFixed(
      1,
    ),
    maxZ: +Math.max(...rim.map((s) => s.z)).toFixed(3),
    outwardVelocityTail: +outwardTail.toFixed(4),
    jitterMetres: +jitter.toFixed(4),
    travelCreditedWhileBlocked: +credited.toFixed(4),
    hudSpeedTail: tails[tails.length - 1].hud,
  };

  // 4. A save from far away has to come back from far away. The app's own persistence runs;
  //    the reload decides -- which is precisely the guard this stage changed.
  const far = { x: -180, z: 240 };
  const before = await page.evaluate(
    async ({ far }) => {
      const g = window.__SF,
        b = g.body;
      b.x = far.x;
      b.z = far.z;
      b.y = g.region.sample(far.x, far.z).height;
      b.vx = 0;
      b.vz = 0;
      b.vy = 0;
      // Two frames so the simulation has mirrored the body into its own state before the
      // save is taken -- the app's player position is authoritative, not the test's.
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      return { ...g.state.player, height: +b.y.toFixed(2) };
    },
    { far },
  );
  assert.ok(
    Math.abs(before.z) > 70,
    `the app refused to hold a position outside the old box (player z ${before.z})`,
  );
  // The player's own save button (invoked directly: it lives in a panel that the journey
  // is not testing here), then the reload. No fabricated save payload.
  await page.evaluate(() => document.querySelector("#save").click());
  await new Promise((r) => setTimeout(r, 1200));
  evidence.saveAttempt = await page.evaluate(() => {
    const raw = localStorage.getItem("squirtle_frontier_baseline_v1");
    return {
      status: (document.querySelector("#status")?.textContent ?? "").slice(
        0,
        120,
      ),
      stored: raw ? JSON.parse(raw).player : null,
    };
  });
  await page.waitForFunction(
    (z) => {
      try {
        const raw = localStorage.getItem("squirtle_frontier_baseline_v1");
        return raw && Math.abs(JSON.parse(raw).player.z - z) < 1;
      } catch {
        return false;
      }
    },
    far.z,
    { timeout: 45000 },
  );
  await page.reload();
  await page.waitForFunction(
    () =>
      window.__SF?.streaming.stats().active === 9 &&
      window.__SF.loop.frames.length > 10,
  );
  const restored = await page.evaluate(() => ({
    player: { ...window.__SF.state.player },
    body: { ...window.__SF.body },
    stats: window.__SF.stats(),
  }));
  assert.ok(
    Math.abs(restored.body.z - far.z) < 1,
    `reload brought the body back at z ${restored.body.z.toFixed(1)}, not ${far.z}`,
  );
  assert.ok(
    Math.hypot(restored.body.vx, restored.body.vz) < 0.5,
    "the restored body arrived with velocity it never had",
  );
  assert.equal(
    restored.stats.chunks.active,
    9,
    "the world did not stream in at a distance",
  );
  assert.ok(
    Number.isFinite(restored.body.x) &&
      Number.isFinite(restored.body.y) &&
      Number.isFinite(restored.body.z),
    "restored state is not finite",
  );
  const farRun = await page.evaluate(SAMPLER, {
    ms: 3000,
    keys: ["KeyW"],
    bodyRadius: CONTACT.bodyRadius,
  });
  assert.ok(
    finite(farRun.map((s) => s.gap)).every((v) => v >= -1e-6),
    "far from spawn the body was inside a collider",
  );
  assert.ok(
    farRun[farRun.length - 1].distance - farRun[0].distance > 4,
    "movement did not work at a distance from spawn",
  );
  evidence.distantSave = {
    seeded: before,
    restored: restored.player,
    restoredBody: {
      x: +restored.body.x.toFixed(2),
      z: +restored.body.z.toFixed(2),
    },
    framesSampled: farRun.length,
    metresTravelledAfterRestore: +(
      farRun[farRun.length - 1].distance - farRun[0].distance
    ).toFixed(1),
    note: "under the previous guard this save was discarded for spawn at (-10, 18)",
  };

  // 5. Contact work has to be free at the frame level. Timing is reported, not asserted as
  //    a device measurement; the only claim made is that collision cost does not dominate.
  const cost = await page.evaluate(async () => {
    const g = window.__SF,
      measure = async (ms) => {
        const t = [];
        let last = performance.now();
        const start = last;
        while (performance.now() - start < ms) {
          await new Promise((r) => requestAnimationFrame(r));
          const now = performance.now();
          t.push(now - last);
          last = now;
        }
        return t;
      },
      med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
    g.input.keys.add("KeyW");
    const open = await measure(2500);
    g.input.keys.add("ShiftLeft");
    const busy = await measure(2500);
    g.input.keys.delete("KeyW");
    g.input.keys.delete("ShiftLeft");
    return {
      openMedian: +med(open).toFixed(2),
      busyMedian: +med(busy).toFixed(2),
      openFrames: open.length,
      busyFrames: busy.length,
    };
  });
  evidence.frameCost = {
    ...cost,
    note: "wall clock in a software rasteriser, reported rather than asserted",
  };
  assert.ok(
    cost.busyMedian < cost.openMedian * 1.6 + 8,
    `running through the treeline moved the frame time from ${cost.openMedian} ms to ${cost.busyMedian} ms`,
  );

  assert.deepEqual(errors, [], "page errors during the collision journey");
  evidence.summary =
    `${run.length} frames of running with no collider penetration, a ${peakImpact.toFixed(2)} impact ` +
    `resolved against a real tree, the rim stopping the body at ${PLAYABLE_BOUND} m with ` +
    `${credited.toFixed(3)} m credited while blocked, and a save from ${far.z} m restoring where it ` +
    `was written. Human feel remains unverified.`;
  console.log(evidence.summary);
} catch (error) {
  evidence.failure = error.message;
  throw error;
} finally {
  evidence.pageErrors = errors;
  await writeFile(
    "docs/qa/locomotion-collision-browser.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  await browser.close();
}
