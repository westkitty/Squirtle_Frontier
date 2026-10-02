import { test } from "node:test";
import assert from "node:assert/strict";
import { StatusArbiter, CHANNELS as C } from "../src/status-arbiter.js";
import {
  createFeedback,
  telemetryLines,
} from "../src/player/locomotion-feedback.js";
import { createBody } from "../src/player/body-state.js";
import { stepBody } from "../src/player/squirtle-controller.js";
import { Loop } from "../src/loop.js";
import { region } from "../src/player/movement-region.js";
import { heightAt } from "../src/worldgen.js";
import { WorldState } from "../src/worldstate.js";
import { save, load } from "../src/persistence.js";
import { aimFromRig, aimTarget } from "../src/player/aim-authority.js";
import { jetHit } from "../src/beam.js";

const dt = 1 / 60;
test("requested status survives incidental cues and ambient updates", () => {
  const s = new StatusArbiter({ ambient: "bank" });
  s.say("Saved.", C.request);
  for (let i = 0; i < 180; i++) {
    s.tick(dt);
    s.note("swimming");
    s.say("bumped", C.contextual);
    assert.equal(s.text, "Saved.");
  }
  assert.equal(s.writes, 1);
  for (let i = 0; i < 61; i++) s.tick(dt);
  assert.equal(s.text, "swimming"); // rejected cues never become stale announcements
});
test("status repeats do not starve expiry; invalid clocks do not corrupt it", () => {
  const s = new StatusArbiter({ ambient: "bank", hold: 1 });
  s.say("Saved.", C.request);
  for (let i = 0; i < 59; i++) {
    s.tick(dt);
    s.say("Saved.", C.request);
  }
  s.tick(NaN);
  s.tick(-2);
  s.tick(dt * 2);
  assert.equal(s.text, "bank");
});
test("status lifetime is independent of render cadence", () => {
  for (const rate of [30, 60, 120]) {
    const s = new StatusArbiter({ ambient: "bank" });
    const loop = new Loop(
      () => s.tick(dt),
      () => {},
    );
    s.say("Saved.", C.request, 2);
    for (let i = 0; i <= rate * 3; i++) loop.frame((i * 1000) / rate);
    assert.equal(s.text, "bank");
    assert.equal(s.writes, 2);
  }
});
test("blocked cues distinguish steep ground, solids and rim without repeated announcements", () => {
  for (const blocked of ["slope", "solid", "rim"]) {
    const f = createFeedback(),
      b = createBody();
    b.blocked = blocked;
    assert.ok(f.read(b)?.text);
    for (let i = 0; i < 600; i++) {
      f.tick(dt);
      assert.equal(f.read(b), null);
    }
    b.blocked = null;
    f.read(b);
    b.blocked = blocked;
    assert.ok(f.read(b)?.text);
  }
});
test("jet ready cue requires a prior cooldown; depth cue requires a transition", () => {
  const f = createFeedback(),
    b = createBody();
  assert.equal(f.read(b), null);
  b.jetCooldown = 1;
  assert.equal(f.read(b), null);
  b.jetCooldown = 0;
  assert.match(f.read(b).text, /charged/);
  b.submersion = 0.2;
  f.read(b);
  b.submersion = 1.5;
  assert.match(f.read(b).text, /Down here/);
  assert.equal(f.read(b), null);
});
test("telemetry reports authoritative values, not status messages", () => {
  const rows = Object.fromEntries(
    telemetryLines({
      mode: "wade",
      speed: 2.3,
      submersion: 0.22,
      jet01: 0.5,
      blocked: "solid",
      scale: 0.7,
      chunks: { active: 9, held: 1, queued: 2, holes: 0 },
    }),
  );
  assert.equal(rows["Ground speed"], "2.3 m/s");
  assert.equal(rows["Render scale"], "70%");
  assert.equal(rows["Jet charge"], "50%");
  assert.equal(rows["Ground missing"], "0");
  assert.ok(!JSON.stringify(rows).includes("NaN"));
});
test("settled water telemetry agrees with the final position, not the preceding step", () => {
  const b = createBody(0, 0, -0.5),
    env = {
      sample: () => ({ height: -2, dx: 0, dz: 0 }),
      water: () => ({ level: 0, currentX: 0, currentZ: 0 }),
      obstacles: [],
    };
  stepBody(b, { x: 0, z: 1, dive: true }, env, dt);
  assert.equal(b.depth, 2);
  assert.equal(b.submersion, -b.y);
});
test("continuous fixed-step shoreline route remains deterministic across rendered cadences", () => {
  const run = (rate) => {
    const b = createBody(-10, 18, heightAt(-10, 18)),
      modes = new Set();
    let ticks = 0;
    const loop = new Loop(
      () => {
        stepBody(
          b,
          { x: ticks < 240 ? 1 : -1, z: 0, dive: ticks >= 100 && ticks < 210 },
          region,
          dt,
        );
        modes.add(b.mode);
        ticks++;
      },
      () => {},
    );
    for (let i = 0; i <= rate * 8; i++) loop.frame((i * 1000) / rate);
    loop.frame(8000.001); // common end instant, beyond the floating-point tick boundary
    return { b, modes: [...modes], ticks };
  };
  const baseline = run(60);
  assert.ok(baseline.modes.includes("wade"));
  assert.ok(baseline.modes.includes("dive"));
  for (const rate of [30, 120]) {
    const r = run(rate);
    assert.equal(r.ticks, baseline.ticks);
    assert.ok(
      Math.hypot(
        r.b.x - baseline.b.x,
        r.b.y - baseline.b.y,
        r.b.z - baseline.b.z,
      ) < 1e-8,
    );
  }
});
test("aim target selection and mechanics agree while the body faces elsewhere", () => {
  const b = createBody(0, 0, 0);
  b.yaw = Math.PI;
  for (const yaw of [-2, 0, 1, 2]) {
    const aim = aimFromRig({ yaw, pitch: 0.2 }, b);
    const target = { x: aim.x * 2, y: aim.y * 2, z: aim.z * 2 };
    assert.equal(!!aimTarget(aim, [target]), !!jetHit(aim, target));
    assert.ok(jetHit(aim, target));
  }
});
test("distant survey and pose survive a complete save/load round trip", () => {
  const s = new WorldState();
  s.player = { x: -180, z: 240 };
  s.pose = { ...s.player, y: heightAt(-180, 240), yaw: 0, place: "frontier" };
  s.memory.observe(s.player, "frontier", 0, s.ecosystem);
  const map = new Map(),
    storage = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, v),
    };
  assert.equal(save(s, storage, 1000).ok, true);
  const restored = new WorldState();
  assert.equal(load(restored, storage, { offline: false }).ok, true);
  assert.deepEqual(restored.player, s.player);
  assert.deepEqual(restored.memory.snapshot(), s.memory.snapshot());
});

test("high frontier ground remains saveable beyond the prototype altitude ceiling", () => {
  const s = new WorldState();
  s.player = { x: 700, z: 600 };
  s.pose = { ...s.player, y: heightAt(700, 600), yaw: 0, place: "frontier" };
  assert.ok(s.pose.y > 60, "fixture must exceed the old ceiling");
  const map = new Map(),
    storage = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, v),
    };
  assert.equal(save(s, storage, 1000).ok, true);
  const restored = new WorldState();
  assert.equal(load(restored, storage, { offline: false }).ok, true);
  assert.deepEqual(restored.pose, s.pose);
  s.pose.y += 100;
  assert.equal(
    save(s, storage, 2000).ok,
    false,
    "nonphysical high poses still rejected",
  );
});

test("overlapping real rock/tree proxies cannot push a clear body into each other", () => {
  const b = createBody(-12, 18, heightAt(-12, 18));
  const drive = (x, z, n) => {
    for (let i = 0; i < n; i++) {
      const dx = x - b.x,
        dz = z - b.z,
        m = Math.max(1, Math.hypot(dx, dz));
      stepBody(b, { x: dx / m, z: dz / m }, region, dt);
      for (const o of region.obstaclesAt(b.x, b.z)) {
        const base = region.sample(o.x, o.z).height;
        if (b.y + 0.23 <= base || b.y - 0.23 >= base + o.height) continue;
        assert.ok(
          Math.hypot(b.x - o.x, b.z - o.z) >= o.radius + 0.23 - 1e-5,
          "penetrated a proxy",
        );
      }
    }
  };
  drive(-17, 20, 180);
  assert.equal(b.blocked, "solid");
  drive(-12, 18, 240);
  assert.ok(Math.hypot(b.x + 12, b.z - 18) < 0.2, "could not retreat");
});
