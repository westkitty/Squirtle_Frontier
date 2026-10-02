// Locomotion Zero, stage 5: one aim authority for the Water Jet.
//
// The headline case the campaign names: stand still, rotate the camera 90 degrees,
// fire at what the centre of the view is now on, and prove the old locomotion
// heading has no say. Mechanics, VFX and the indicator are then checked against the
// same vector, because an aim that only the hit test understands is an aim the player
// cannot see.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { JET_RULES, aimFromYaw, beamHit, jetHit } from "../src/beam.js";
import {
  aimFromRig,
  aimHeading,
  aimTarget,
  JET_REACH,
} from "../src/player/aim-authority.js";
import { CreatureCamera } from "../src/player/creature-camera.js";
import { createBody } from "../src/player/body-state.js";
import { stepBody } from "../src/player/squirtle-controller.js";
import {
  DEBRIS_SITE,
  applyWaterJet,
  applyWorldJet,
  jetTargets,
} from "../src/simulation/water-interaction.js";
import { heightAt } from "../src/worldgen.js";
import {
  BYPASS_SITE,
  FrontierSystems,
  fireSite,
} from "../src/simulation/frontier-systems.js";
import { Watershed } from "../src/simulation/watershed.js";
import { WorldEffects } from "../src/player/world-effects.js";

const flat = {
  sample: () => ({ height: 0, dx: 0, dz: 0 }),
  water: () => null,
  obstacles: [],
};
const SETTINGS = { sensitivity: 1, invertY: false, reducedMotion: true };
function view(yaw = 0, pitch = 0) {
  const rig = new CreatureCamera(
    new THREE.PerspectiveCamera(55, 1.5, 0.04, 100),
    flat,
  );
  rig.yaw = yaw;
  rig.pitch = pitch;
  return rig;
}
const site = (x, z) => ({ x, z, y: heightAt(x, z) });

test("the view, not the travel heading, decides what a burst hits", () => {
  const body = createBody(DEBRIS_SITE.x, DEBRIS_SITE.z + 2, 0);
  body.jetTime = 0.2;
  // Facing east, looking north at the debris: the debris is hit.
  body.yaw = Math.PI / 2;
  const aimed = site(DEBRIS_SITE.x, DEBRIS_SITE.z);
  assert.ok(
    jetHit(aimFromYaw(Math.PI, body), aimed),
    "the northward beam must reach it",
  );
  assert.ok(
    applyWaterJet(new Watershed(), body, 1 / 30, aimFromYaw(Math.PI, body)),
    "aiming with the view has to clear debris while the body faces elsewhere",
  );
  // Same body heading, view turned 180: nothing is hit, because the heading is not
  // the authority any more.
  const before = new Watershed();
  const blockageBefore = before.nodes[1].blockage;
  applyWaterJet(before, body, 1 / 30, aimFromYaw(0, body));
  assert.equal(
    before.nodes[1].blockage,
    blockageBefore,
    "an unaimed burst must not clear",
  );
  assert.equal(jetHit(aimFromYaw(0, body), aimed), null);
});

test("a 90 degree turn while standing still retargets the beam", () => {
  const rig = view(Math.PI, 0); // looking north
  const body = createBody(DEBRIS_SITE.x, DEBRIS_SITE.z + 2, 0);
  body.vx = 0;
  body.vz = 0;
  const targets = jetTargets(new FrontierSystems(1337));
  const first = aimTarget(aimFromRig(rig, body), targets);
  assert.ok(first, "the debris should be in the beam to start with");
  assert.equal(first.target.id, "landslide");
  // Turn a quarter circle with the look axis alone - no movement, no heading change.
  rig.applyLook({ x: -Math.PI / 2 / 0.004, y: 0 }, SETTINGS);
  assert.equal(
    body.yaw,
    Math.PI,
    "locomotion heading must be untouched by a look",
  );
  const second = aimTarget(aimFromRig(rig, body), targets);
  assert.ok(
    !second || second.target.id !== "landslide",
    "the beam never moved",
  );
  assert.notEqual(
    +aimFromRig(rig, body).x.toFixed(6),
    +Math.sin(Math.PI).toFixed(6),
    "the beam must follow the view",
  );
});

test("moving while aiming keeps working, and aim does not steer the path", () => {
  const rig = view(Math.PI / 2, 0); // looking east while travelling north
  const body = createBody(0, 0, 0);
  body.yaw = 0;
  const before = { vx: 0, vz: 4 };
  body.vx = before.vx;
  body.vz = before.vz;
  const aim = aimFromRig(rig, body);
  // A burst with no target in front of it still propels, along the aim heading.
  stepBody(
    body,
    { x: 0, z: 1, jet: true, aimYaw: aimHeading(aim) },
    flat,
    1 / 60,
  );
  assert.ok(
    body.vx > 5,
    `the lunge did not follow the stream (vx ${body.vx.toFixed(2)})`,
  );
  assert.ok(
    Math.abs(aimHeading(aim) - Math.PI / 2) < 1e-9,
    "east aim, east lunge",
  );
  // And the body presents the aim over the burst rather than snapping to it.
  const turn = createBody(0, 0, 0);
  turn.yaw = 0;
  const start = turn.yaw;
  stepBody(turn, { jet: true, aimYaw: Math.PI / 2 }, flat, 1 / 60);
  const moved = turn.yaw - start;
  assert.ok(
    moved > 0 && moved < 0.35,
    `facing moved ${moved.toFixed(3)} rad at once`,
  );
  for (let i = 0; i < 20; i++)
    stepBody(turn, { jet: true, aimYaw: Math.PI / 2 }, flat, 1 / 60);
  assert.ok(
    Math.abs(turn.yaw - Math.PI / 2) < 0.25,
    "facing never settled on the aim",
  );
});

test("range, cooldown and burst stay bounded rules", () => {
  const body = createBody(0, 0, 0);
  body.jetTime = 0.2;
  const near = { x: 0, z: JET_REACH - 0.1, y: 0 };
  const far = { x: 0, z: JET_REACH + 0.3, y: 0 };
  assert.ok(jetHit(aimFromYaw(0, body), near), "inside reach has to connect");
  assert.equal(
    jetHit(aimFromYaw(0, body), far),
    null,
    "reach is a rule, not a suggestion",
  );
  assert.equal(
    JET_REACH,
    JET_RULES.range,
    "presentation must read the same reach",
  );
  const swimmer = createBody(0, 0, 0);
  stepBody(swimmer, { jet: true }, flat, 1 / 60);
  assert.ok(Math.abs(swimmer.jetCooldown - JET_RULES.cooldown) < 1e-9);
  assert.ok(Math.abs(swimmer.jetTime - JET_RULES.burst) < 1e-9);
  const held = { jet: true };
  for (let i = 0; i < 90; i++) stepBody(swimmer, held, flat, 1 / 60);
  assert.ok(swimmer.jetTime === 0, "the burst has to end");
  stepBody(swimmer, { jet: true }, flat, 1 / 60);
  assert.ok(
    swimmer.jetCooldown > 0,
    "and cannot be re-fired before the cooldown",
  );
  // A jet with no aim authority resolves to nothing rather than to the body heading.
  assert.equal(applyWaterJet(new Watershed(), body, 1 / 30, undefined), false);
  assert.equal(
    applyWorldJet(new FrontierSystems(1337), body, 1 / 30, undefined),
    undefined,
  );
});

test("fire, ash and the bypass answer to the same vector as debris", () => {
  const frontier = new FrontierSystems(1337);
  const fire = site(fireSite(0).x, fireSite(0).z);
  frontier.heat[0] = 0.6;
  frontier.soaked[0] = 0;
  frontier.ash[0] = 0.8;
  const body = createBody(fire.x, fire.z - 1.0, 0);
  body.yaw = 0;
  body.jetTime = 0.3;
  const aim = aimFromYaw(0, body);
  const resolved = aimTarget(aim, jetTargets(frontier));
  assert.equal(
    resolved?.target.id,
    "fire0",
    "the resolver must name the same site",
  );
  applyWorldJet(frontier, body, 0.4, aim);
  assert.ok(
    frontier.heat[0] < 0.6,
    "aimed jet cools the site the resolver named",
  );
  assert.ok(frontier.soaked[0] > 0, "and wets it");
  assert.ok(frontier.ash[0] < 0.8, "and rinses the ash off it");
  // Turn away and nothing moves, even though the burst is still firing.
  const heat = frontier.heat[0];
  const away = aimFromYaw(Math.PI, body);
  applyWorldJet(frontier, body, 0.4, away);
  assert.equal(
    frontier.heat[0],
    heat,
    "an unaimed burst must not cool anything",
  );
  // The bypass groove is a Jet target too, and reads the same rule.
  const bypass = site(BYPASS_SITE.x, BYPASS_SITE.z);
  const toward = createBody(
    bypass.x,
    bypass.z + 1.4,
    heightAt(bypass.x, bypass.z + 1.4),
  );
  toward.jetTime = 0.3;
  const up = aimFromYaw(Math.PI, toward);
  assert.ok(
    jetHit(up, bypass),
    "a groove in the bank is aimable like anything else",
  );
  const before = frontier.bypass;
  applyWorldJet(frontier, toward, 0.5, up);
  assert.ok(frontier.bypass > before, "and opens when the beam is on it");
});

test("the stream the player sees is the beam the mechanics use", async () => {
  const scene = new THREE.Scene();
  const effects = new WorldEffects(scene);
  const body = createBody(0, 0, 0);
  body.jetTime = 0.3;
  const rig = view(Math.PI / 2, 0.5); // east and down
  const aim = aimFromRig(rig, body);
  effects.update({ elapsed: 1, frontier: new FrontierSystems(1337) }, body, {
    aim,
  });
  const tip = new THREE.Matrix4();
  effects.jet.getMatrixAt(23, tip);
  const point = new THREE.Vector3().setFromMatrixPosition(tip);
  const drawn = point
    .clone()
    .sub(new THREE.Vector3(body.x, body.y + 0.22, body.z));
  const drawnLength = drawn.length();
  assert.ok(
    drawnLength > 2.2,
    `the stream barely drew (${drawnLength.toFixed(2)})`,
  );
  const ray = new THREE.Vector3(aim.x, aim.y, aim.z),
    dot = drawn.clone().divideScalar(drawnLength).dot(ray);
  assert.ok(
    dot > 0.985,
    `VFX diverged from the aim beam (cos ${dot.toFixed(4)})`,
  );
  // Read it as geometry rather than as an angle: the far end of the drawn stream has
  // to sit *on* the beam at the mechanics' own reach, turbulence and all.
  const along = drawn.dot(ray),
    perpendicular = drawn
      .clone()
      .sub(ray.clone().multiplyScalar(along))
      .length();
  assert.ok(
    Math.abs(along - JET_REACH) < 0.35,
    `the stream ends ${along.toFixed(2)} m out; the rule says ${JET_REACH}`,
  );
  assert.ok(
    perpendicular < 0.35,
    `the stream drifts ${(perpendicular * 100).toFixed(0)} cm off the beam it claims`,
  );
  effects.dispose();
  assert.equal(
    scene.children.length,
    0,
    "effects have to leave the scene clean",
  );
});

test("the indicator may only light for a shot the rules honour", () => {
  const body = createBody(DEBRIS_SITE.x, DEBRIS_SITE.z + 2, 0);
  const targets = jetTargets(new FrontierSystems(1337));
  let lit = 0;
  for (let i = 0; i < 360; i++) {
    const yaw = (i / 360) * Math.PI * 2,
      aim = aimFromYaw(yaw, body),
      shown = aimTarget(aim, targets);
    const real = targets.some((t) => jetHit(aim, t) !== null);
    assert.equal(
      !!shown,
      real,
      `yaw ${yaw}: indicator disagreed with the rule`,
    );
    if (shown) lit++;
  }
  assert.ok(lit > 0 && lit < 90, `a full sweep lit ${lit} of 360 headings`);
});

test("touch aim goes through the same authority as mouse aim", () => {
  // Touch look and mouse look both land in the same accumulator, so the jet reads
  // one vector for both - asserted by driving the rig the way a drag would.
  const rig = view(0, 0);
  rig.applyLook({ x: 40, y: -18 }, SETTINGS); // a thumb drag: right and up
  const touch = aimFromRig(rig, createBody(0, 0, 0));
  const mouse = view(0, 0);
  mouse.applyLook({ x: 40, y: -18 }, SETTINGS);
  const fromMouse = aimFromRig(mouse, createBody(0, 0, 0));
  for (const axis of ["x", "y", "z"])
    assert.ok(
      Math.abs(touch[axis] - fromMouse[axis]) < 1e-12,
      `${axis} diverged`,
    );
  assert.ok(touch.y > 0, "an upward drag has to lift the beam");
  assert.ok(Math.abs(touch.x) > 0.05, "and a sideways drag has to swing it");
});

test("the strict beam is still a real line, for anything that wants it", () => {
  const body = createBody(0, 0, 0);
  const level = aimFromYaw(0, body);
  assert.ok(
    beamHit(level, { x: 0, y: 0, z: 1 }),
    "a target on the line is on the line",
  );
  assert.equal(
    beamHit(level, { x: 0, y: 0, z: 10 }),
    null,
    "reach is measured along the beam",
  );
  assert.equal(
    beamHit(level, { x: 0, y: 0, z: -1 }),
    null,
    "behind is not in front",
  );
  // The forgiving rule exists for ground features; it must not swallow sideways ones.
  assert.equal(
    jetHit(level, { x: 2, y: 0, z: 0 }),
    null,
    "perpendicular is a miss",
  );
  assert.ok(
    jetHit(level, { x: 0.3, y: 0.4, z: 1.6 }),
    "a bank in front is a hit",
  );
});
