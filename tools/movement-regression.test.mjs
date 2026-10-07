import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createBody } from "../src/player/body-state.js";
import { stepBody } from "../src/player/squirtle-controller.js";
import { CreatureCamera } from "../src/player/creature-camera.js";
import { pixelRatioFor, DETAIL_BUDGETS } from "../src/render-quality.js";
const controls = (extra) => ({
  x: 0,
  z: 0,
  slide: false,
  jet: false,
  run: false,
  dive: false,
  ascend: false,
  ...extra,
});
const flat = {
  sample: () => ({ height: 0, dx: 0, dz: 0 }),
  water: () => null,
  obstacles: [],
};
test("descending slide follows continuous slope without repeated takeoff impulses", () => {
  const slope = {
    ...flat,
    sample: (x, z) => ({ height: -z * 0.2, dx: 0, dz: -0.2 }),
  };
  const body = createBody(0, 0, 0);
  body.yaw = 0;
  for (let i = 0; i < 300; i++) {
    const speed = Math.hypot(body.vx, body.vz);
    stepBody(body, controls({ slide: true }), slope, 1 / 60);
    assert.equal(body.grounded, true, `lost contact at step ${i}`);
    assert.equal(body.mode, "slide");
    assert.ok(Math.abs(body.y + body.z * 0.2) < 1e-8);
    if (i > 0)
      assert.ok(
        Math.hypot(body.vx, body.vz) - speed < 0.041,
        "unexpected free slide boost",
      );
  }
});
test("tapping slide never stacks entry impulses and held landing never reboosts", () => {
  const body = createBody(0, 0, 0);
  body.yaw = 0;
  for (let i = 0; i < 120; i++) {
    stepBody(body, controls({ slide: i % 2 === 0 }), flat, 1 / 60);
    assert.ok(Math.hypot(body.vx, body.vz) <= 3);
  }
  Object.assign(body, {
    y: 1,
    vy: -2,
    vz: 1,
    grounded: false,
    mode: "air",
    slideHeld: true,
  });
  for (let i = 0; i < 90; i++) {
    const speed = Math.hypot(body.vx, body.vz);
    stepBody(body, controls({ slide: true }), flat, 1 / 60);
    assert.ok(Math.hypot(body.vx, body.vz) <= speed + 1e-8);
  }
  assert.equal(body.mode, "slide");
});
test("ground snapping excludes cliffs and intentional jet launch", () => {
  const cliff = {
    ...flat,
    sample: (x, z) => ({ height: z > 0.1 ? -5 : 0, dx: 0, dz: 0 }),
  };
  const b = createBody(0, 0, 0);
  b.yaw = 0;
  b.vz = 8;
  stepBody(b, controls({ slide: true }), cliff, 1 / 60);
  assert.equal(b.grounded, false);
  assert.ok(b.y > -0.1);
  const launch = createBody(0, 0, 0);
  stepBody(launch, controls({ jet: true }), flat, 1 / 60);
  stepBody(launch, controls({}), flat, 1 / 60);
  assert.ok(launch.y > 0);
  assert.equal(launch.grounded, false);
});
test("camera final position stays clear while orbiting and after teleport across pillar", () => {
  const env = { ...flat, obstacles: [{ x: 0, z: 1, radius: 0.35, height: 3 }] };
  const body = createBody(0, 0, 0);
  for (const hz of [30, 60, 120]) {
    const rig = new CreatureCamera(
      new THREE.PerspectiveCamera(55, 1.5, 0.04, 100),
      env,
    );
    const settings = { sensitivity: 1, invertY: false, reducedMotion: false };
    rig.camera.position.set(0, 0.8, 1);
    rig.initial = false; // invalid inherited position
    for (let i = 0; i < hz * 3; i++) {
      rig.update(
        body,
        { lookX: i === 0 ? 0 : 2, lookY: 0 },
        i === hz ? 0.25 : 1 / hz,
        settings,
      );
      const p = rig.camera.position;
      assert.ok(Math.hypot(p.x, p.z - 1) >= 0.469, "camera inside pillar");
      assert.ok(p.y >= 0.12);
      assert.ok(
        p.distanceTo(rig.target) > 0.2,
        "boom collapsed at valid body location",
      );
    }
    rig.yaw = 0;
    for (let i = 0; i < hz; i++)
      rig.update(body, { lookX: 0, lookY: 0 }, 1 / hz, settings);
    assert.ok(
      rig.camera.position.distanceTo(rig.target) > 2,
      "camera failed to recover",
    );
  }
});
test("camera sensitivity covers both axes and reduced motion removes dynamic FOV", () => {
  const a = new CreatureCamera(
      new THREE.PerspectiveCamera(55, 1, 0.04, 100),
      flat,
    ),
    b = new CreatureCamera(new THREE.PerspectiveCamera(55, 1, 0.04, 100), flat),
    body = createBody(0, 0, -1);
  a.update(body, { lookX: 10, lookY: 10 }, 1 / 60, {
    sensitivity: 1,
    reducedMotion: true,
  });
  b.update(body, { lookX: 10, lookY: 10 }, 1 / 60, {
    sensitivity: 2,
    reducedMotion: true,
  });
  assert.ok(Math.abs(b.pitch - 0.26 - 2 * (a.pitch - 0.26)) < 1e-8);
  assert.equal(a.camera.fov, 55);
});
test("render budgets cap pixels on large/high-density screens without changing CSS size", () => {
  for (const q of Object.keys(DETAIL_BUDGETS))
    for (const [w, h, dpr] of [
      [960, 640, 1],
      [390, 844, 3],
      [3840, 2160, 2],
    ]) {
      const r = pixelRatioFor(q, w, h, dpr);
      assert.ok(w * h * r * r <= DETAIL_BUDGETS[q].maxPixels + 1e-6);
      assert.ok(r <= dpr);
    }
  assert.equal(pixelRatioFor("low", 960, 640), Math.sqrt(230400 / (960 * 640)));
});

test("fast shell slide widens camera FOV and extends boom distance dynamically", () => {
  const env = { ...flat, obstacles: [] };
  const rig = new CreatureCamera(
    new THREE.PerspectiveCamera(55, 1.5, 0.04, 100),
    env,
  );
  const body = createBody(0, 0, 0);
  body.mode = "slide";
  body.vx = 4.0;
  body.vz = 0;

  // With reducedMotion: false, slide accelerates FOV and distance
  for (let i = 0; i < 30; i++) {
    rig.update(body, { lookX: 0, lookY: 0 }, 1 / 60, {
      sensitivity: 1,
      invertY: false,
      reducedMotion: false,
    });
  }
  assert.ok(
    rig.camera.fov > 58,
    `FOV should expand during fast slide, was ${rig.camera.fov}`,
  );
  const dist = rig.target.distanceTo(rig.desired);
  assert.ok(
    dist >= 2.6,
    `boom distance should expand during fast slide, was ${dist}`,
  );

  // With reducedMotion: true, FOV stays strictly at 55
  for (let i = 0; i < 30; i++) {
    rig.update(body, { lookX: 0, lookY: 0 }, 1 / 60, {
      sensitivity: 1,
      invertY: false,
      reducedMotion: true,
    });
  }
  assert.equal(rig.camera.fov, 55);
});

test("tactile impact micro-recoil triggers on hard landing and decays smoothly", () => {
  const env = { ...flat, obstacles: [] };
  const rig = new CreatureCamera(
    new THREE.PerspectiveCamera(55, 1.5, 0.04, 100),
    env,
  );
  const body = createBody(0, 0, 0);
  body.impact = 0.5;

  rig.update(body, { lookX: 0, lookY: 0 }, 1 / 60, {
    sensitivity: 1,
    invertY: false,
    reducedMotion: false,
  });
  assert.ok(
    rig.impactRecoil > 0.03,
    `impactRecoil should trigger on impact, was ${rig.impactRecoil}`,
  );

  // Decays over settling frames
  body.impact = 0;
  for (let i = 0; i < 20; i++) {
    rig.update(body, { lookX: 0, lookY: 0 }, 1 / 60, {
      sensitivity: 1,
      invertY: false,
      reducedMotion: false,
    });
  }
  assert.ok(
    rig.impactRecoil < 0.005,
    `impactRecoil should decay cleanly, was ${rig.impactRecoil}`,
  );
});


test("swimming coasts instead of snapping to a stop when analog input is released", () => {
  const water = {
    sample: () => ({ height: 0, dx: 0, dz: 0 }),
    water: () => ({ level: 1, currentX: 0, currentZ: 0 }),
    obstacles: [],
  };
  const body = createBody(0, 0, 0.7);
  Object.assign(body, { grounded: false, mode: "swim", vx: 3, vz: 0 });
  for (let i = 0; i < 30; i++)
    stepBody(body, controls({}), water, 1 / 60);
  assert.ok(
    Math.hypot(body.vx, body.vz) > 1.2,
    "released swim input should retain a readable glide",
  );
});

test("camera accepts rate-based controller look and widens for fast travel and Water Jet", () => {
  const rig = new CreatureCamera(
    new THREE.PerspectiveCamera(55, 1.5, 0.04, 100),
    flat,
  );
  const body = createBody(0, 0, 0);
  const startYaw = rig.yaw;
  rig.update(
    body,
    { lookX: 0, lookY: 0, lookRateX: 1, lookRateY: 0 },
    1 / 60,
    { sensitivity: 1, invertY: false, reducedMotion: false },
  );
  assert.ok(rig.yaw < startYaw, "right stick should rotate the camera by time");

  body.vx = 4.5;
  for (let i = 0; i < 30; i++)
    rig.update(body, { lookX: 0, lookY: 0 }, 1 / 60, {
      sensitivity: 1,
      invertY: false,
      reducedMotion: false,
    });
  assert.ok(rig.camera.fov > 55, "fast travel should open the field of view");

  body.jetTime = 0.2;
  for (let i = 0; i < 15; i++)
    rig.update(body, { lookX: 0, lookY: 0 }, 1 / 60, {
      sensitivity: 1,
      invertY: false,
      reducedMotion: false,
    });
  assert.ok(rig.camera.fov >= 58, "Water Jet should read as a stronger speed event");
});


test("Water Hose temporarily permits a steeper downward camera pitch", () => {
  const rig = new CreatureCamera(
    new THREE.PerspectiveCamera(55, 1.5, 0.04, 100),
    flat,
  );
  const body = createBody(0, 0, 0);
  const settings = { sensitivity: 1, invertY: false, reducedMotion: false };
  body.hoseActive = true;
  rig.pitch = 1;
  rig.update(body, { lookX: 0, lookY: 0 }, 1 / 60, settings);
  assert.ok(rig.pitch > 0.85);
  body.hoseActive = false;
  rig.update(body, { lookX: 0, lookY: 0 }, 1 / 60, settings);
  assert.ok(rig.pitch <= 0.85);
});

test("aquatic camera banks with turns and looks along vertical travel while reduced motion stays quiet", () => {
  const rig = new CreatureCamera(
    new THREE.PerspectiveCamera(55, 1.5, 0.04, 100),
    flat,
  );
  const body = createBody(0, 0, 0);
  const settings = {
    sensitivity: 1,
    invertY: false,
    reducedMotion: false,
  };
  body.mode = "swim";
  body.vx = 2.4;
  body.vz = 0;
  body.yaw = 0;
  body.vy = 0;
  rig.update(body, { lookX: 0, lookY: 0 }, 1 / 60, settings);

  body.yaw = 0.45;
  body.vy = -2.5;
  rig.update(body, { lookX: 0, lookY: 0 }, 1 / 60, settings);
  assert.ok(Math.abs(rig.roll) > 0.005, "turning swim must bank the camera");
  assert.ok(rig.verticalLead < 0, "descending must lower the camera target");

  body.yaw = 0.8;
  body.vy = 2.5;
  rig.update(body, { lookX: 0, lookY: 0 }, 1 / 60, settings);
  assert.ok(rig.verticalLead > 0, "ascending must raise the camera target");

  body.yaw = 1.1;
  rig.update(body, { lookX: 0, lookY: 0 }, 1 / 60, {
    ...settings,
    reducedMotion: true,
  });
  assert.equal(rig.roll, 0);
  assert.equal(rig.verticalLead, 0);
});


test("cached obstacle ground heights avoid procedural resampling in body collision", () => {
  const body = createBody(0, 0, 0),
    env = {
      sample: (x, z) => {
        if (Math.abs(x - 0.5) < 1e-9 && Math.abs(z) < 1e-9)
          throw new Error("static obstacle ground was resampled");
        return { height: 0, dx: 0, dz: 0 };
      },
      water: () => null,
      obstacles: [
        { x: 0.5, z: 0, radius: 0.5, height: 2, ground: 0 },
      ],
    };
  assert.doesNotThrow(() =>
    stepBody(body, controls({ x: 1 }), env, 1 / 60),
  );
});

test("camera-relative movement reuses one scratch vector instead of allocating per fixed step", () => {
  const rig = new CreatureCamera(
    new THREE.PerspectiveCamera(55, 1, 0.04, 100),
    flat,
  );
  rig.yaw = 0.7;
  const first = rig.movement(1, 0.5),
    x = first.x,
    z = first.z,
    second = rig.movement(-0.25, 0.8);
  assert.equal(second, first);
  assert.notEqual(second.x, x);
  assert.notEqual(second.z, z);
});
