// Body-state authority: no Three.js, imported nodes, material names or animation dependencies.
import { clamp } from "../rng.js";
import { recordPose } from "./render-pose.js";
import {
  AQUATIC,
  MODES,
  SHORE,
  depthBands,
  isAquatic,
  resolveShoreMode,
  shoreReading,
  withSubmersion,
} from "./locomotion-states.js";
import { shortestAngle } from "./render-pose.js";
import { JET_RULES } from "../beam.js";
const approach = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
export function stepBody(b, input, env, dt) {
  // The pose the renderer interpolates *from* is the one the body held when this
  // authoritative interval began, so it is captured here rather than by whoever
  // happens to remember to snapshot it.
  recordPose(b);
  const wasGrounded = b.grounded;
  const slidePressed = !!input.slide && !b.slideHeld;
  b.slideHeld = !!input.slide;
  b.jetCooldown = Math.max(0, b.jetCooldown - dt);
  b.jetTime = Math.max(0, b.jetTime - dt);
  b.impact = Math.max(0, b.impact - dt);
  const floor = env.sample(b.x, b.z);
  // Depth is always measured from the active water surface to the terrain under the
  // body, never from a hardcoded plane, so the frontier's rising level, the Lab
  // basin and the Record all feed the same rule.
  const shore = withSubmersion(shoreReading(env, b.x, b.z), b.y);
  const bands = depthBands(b.mode, shore.depth);
  const jetting = b.jetTime > 0;
  const moving = Math.hypot(input.x, input.z) > 0.08;
  // Water holds a body up, so a shore exit needs no airborne interval: `air` is
  // only for when nothing supports the body, plus a jet that has broken the
  // surface under power (an intentional launch still leaves the water as air).
  const supported = b.grounded || bands.wet;
  const breaching = jetting && shore.inWater && shore.submersion <= 0;
  if (!supported || breaching) b.mode = MODES.AIR;
  else {
    const next = resolveShoreMode(b.mode, {
      wet: bands.wet,
      afloat: bands.afloat,
      submersion: shore.submersion,
      diving: !!input.dive,
      sliding: !!input.slide,
    });
    if (next === MODES.SLIDE && slidePressed) {
      // Enter up to a target speed, never stack free impulses on landings/taps.
      const boost = Math.max(0, 3 - Math.hypot(b.vx, b.vz));
      b.vx += Math.sin(b.yaw) * boost;
      b.vz += Math.cos(b.yaw) * boost;
    }
    b.mode = next;
  }
  const aquatic = isAquatic(b.mode);
  const wading = b.mode === MODES.WADE;
  if (
    moving ||
    input.jet ||
    input.slide ||
    !b.grounded ||
    b.mode !== MODES.LAND ||
    wading
  )
    b.resting = false;
  const speed = aquatic ? AQUATIC.speed : wading ? 1.7 : input.run ? 3.8 : 2.2;
  if (moving) {
    const target = Math.atan2(input.x, input.z),
      delta = Math.atan2(Math.sin(target - b.yaw), Math.cos(target - b.yaw));
    b.yaw +=
      delta *
      (1 - Math.exp(-(b.mode === MODES.SLIDE ? 5 : wading ? 8 : 12) * dt));
  }
  if (b.mode === MODES.SLIDE) {
    b.vx -= floor.dx * 12 * dt;
    b.vz -= floor.dz * 12 * dt;
    const momentum = Math.hypot(b.vx, b.vz);
    if (moving) {
      b.vx = approach(b.vx, Math.sin(b.yaw) * momentum, 2.8, dt);
      b.vz = approach(b.vz, Math.cos(b.yaw) * momentum, 2.8, dt);
    }
    const drag = floor.height < 0.5 ? 0.23 : 0.7;
    b.vx *= Math.exp(-drag * dt);
    b.vz *= Math.exp(-drag * dt);
  } else if (aquatic && !jetting) {
    // True 3D swimming. The intent is a world-space vector that the orientation
    // authority has already resolved against camera yaw *and* pitch, so pointing
    // the view down is part of the trajectory rather than a separate axis the
    // player has to reach for.
    const intent = input.intent ?? { x: input.x, y: 0, z: input.z },
      key = (input.dive ? -1 : 0) + (input.ascend ? 1 : 0),
      deep = shore.submersion > SHORE.diveBelow;
    let vertical = intent.y ?? 0;
    // At the surface, sinking has to be meant. A camera tipped a little down while
    // crossing the pond makes the body wallow, because buoyancy answers immediately;
    // it does not plunge.
    if (b.mode === MODES.SWIM && vertical < 0 && !deep)
      vertical *= AQUATIC.surfaceResist;
    const command = clamp(vertical + key, -1, 1),
      // Buoyancy is a surface effect, not a global leash. Inside the band around the
      // float line the body is sprung back to it, which is what makes an accidental
      // descent wallow instead of plunge and what recovers a released diver. Deeper
      // than the band, pitch and the Dive key are the authority - otherwise the
      // spring would out-shout any attempt to actually go somewhere underwater.
      inBand = shore.submersion < SHORE.diveBelow + AQUATIC.bandMargin,
      spring = inBand
        ? clamp(
            (shore.level - SHORE.swimFloat - b.y) * AQUATIC.buoyancy -
              b.vy * AQUATIC.heaveDamping,
            -AQUATIC.recovery,
            AQUATIC.recovery,
          )
        : // Below the band, an *uncommanded* body drifts up on its own positive
          // trim, so releasing a dive cannot strand the body at depth. A body that is
          // being steered is left alone: buoyancy must not tax a deliberate descent.
          Math.abs(command) < 0.02
          ? AQUATIC.trim
          : 0,
      targetY = clamp(
        command * AQUATIC.verticalAuthority + (key >= 0 ? spring : 0),
        -AQUATIC.verticalAuthority * 1.6,
        AQUATIC.verticalAuthority * 1.6,
      ),
      driving = Math.hypot(intent.x, intent.z) > 0.05;
    if (driving) {
      b.vx = approach(
        b.vx,
        intent.x * AQUATIC.speed + shore.currentX,
        AQUATIC.turnRate,
        dt,
      );
      b.vz = approach(
        b.vz,
        intent.z * AQUATIC.speed + shore.currentZ,
        AQUATIC.turnRate,
        dt,
      );
    } else {
      // Inertia is the other half of the feel: a released stroke coasts for metres,
      // and the current keeps carrying the body while it does.
      b.vx = approach(b.vx, shore.currentX, AQUATIC.glide, dt);
      b.vz = approach(b.vz, shore.currentZ, AQUATIC.glide, dt);
    }
    b.vy = approach(
      b.vy,
      targetY,
      key !== 0 ? AQUATIC.commandRate : AQUATIC.turnRate,
      dt,
    );
    b.grounded = false;
    // Facing follows the trajectory rather than the wish, so the body never looks
    // like it is travelling somewhere its momentum disagrees with. The rate is
    // faster than the velocity response on purpose: the turn leads, the path joins it.
    const horizontal = Math.hypot(b.vx, b.vz);
    if (horizontal > AQUATIC.minSpeedToFace)
      b.yaw +=
        shortestAngle(b.yaw, Math.atan2(b.vx, b.vz)) *
        (1 - Math.exp(-AQUATIC.faceRate * dt));
    // Pitch is the trajectory, read back off the velocity, and it is bounded: a body
    // crawling along the bottom must not present as pointing straight down.
    b.pitch = approach(
      b.pitch ?? 0,
      clamp(
        Math.atan2(b.vy, Math.max(0.35, horizontal)),
        -AQUATIC.pitchLimit,
        AQUATIC.pitchLimit,
      ),
      AQUATIC.pitchRate,
      dt,
    );
  } else {
    const rate =
      b.jetTime > 0 ? 0.3 : wading ? 6 : b.grounded ? (moving ? 10 : 14) : 1.1;
    // Wading drags on the surface tension and the substrate; swimming is carried by
    // the current instead. The partial coupling keeps shallows from feeling like a
    // dry tile while still letting a bank be walked.
    const current = wading ? 0.4 : 0;
    if (wading) {
      b.vx *= Math.exp(-1.9 * dt);
      b.vz *= Math.exp(-1.9 * dt);
    }
    b.vx = approach(b.vx, input.x * speed + shore.currentX * current, rate, dt);
    b.vz = approach(b.vz, input.z * speed + shore.currentZ * current, rate, dt);
    b.pitch = approach(b.pitch ?? 0, 0, 6, dt);
  }
  if (input.jet && b.jetCooldown <= 0) {
    b.jetCooldown = JET_RULES.cooldown;
    b.jetTime = JET_RULES.burst;
    // The lunge goes where the stream goes. A body that is aimed at something and a
    // body that is travelling toward it are different situations, and the player has
    // to feel the burst answer the aim - but the *turn* of the body is a bounded ease
    // below, not a snap, so aiming never becomes a second steering control.
    const launch = Number.isFinite(input.aimYaw) ? input.aimYaw : b.yaw;
    b.vx += Math.sin(launch) * 7.8;
    b.vz += Math.cos(launch) * 7.8;
    b.vy = aquatic
      ? b.mode === MODES.SWIM
        ? 5
        : input.dive
          ? -2.5
          : input.ascend
            ? 3
            : 0
      : 3.2;
    b.grounded = false;
  }
  // Controlled facing while the jet is out: the body presents the aim, easing rather
  // than snapping, and only for the burst. Steering authority over the *path* is
  // untouched, which is what keeps a shot from becoming a turn.
  if (b.jetTime > 0 && Number.isFinite(input.aimYaw))
    b.yaw +=
      shortestAngle(b.yaw, input.aimYaw) *
      (1 - Math.exp(-JET_RULES.faceRate * dt));
  const horizontal = Math.hypot(b.vx, b.vz);
  if (horizontal > 12) {
    b.vx *= 12 / horizontal;
    b.vz *= 12 / horizontal;
  }
  if (!(aquatic && !jetting)) b.vy -= 12 * dt;
  const ox = b.x,
    oz = b.z;
  let nx = b.x + b.vx * dt,
    nz = b.z + b.vz * dt;
  const next = env.sample(nx, nz);
  // Body-sized step limit; steep steps block horizontal travel, not vertical jet launches.
  if (b.grounded && next.height - floor.height > 0.18 && b.jetTime === 0) {
    nx = b.x;
    nz = b.z;
    b.vx *= 0.1;
    b.vz *= 0.1;
    b.impact = 0.15;
  }
  for (const o of env.obstaclesAt?.(b.x, b.z) || env.obstacles) {
    const dx = nx - o.x,
      dz = nz - o.z,
      d = Math.hypot(dx, dz),
      radius = o.radius + 0.23;
    if (d < radius && b.y < env.sample(o.x, o.z).height + o.height) {
      const normalX = d > 0.001 ? dx / d : 1,
        normalZ = d > 0.001 ? dz / d : 0;
      nx = o.x + normalX * radius;
      nz = o.z + normalZ * radius;
      const into = b.vx * normalX + b.vz * normalZ;
      if (into < 0) {
        b.vx -= into * normalX * 1.35;
        b.vz -= into * normalZ * 1.35;
      }
      b.impact = 0.2;
    }
  }
  b.x = clamp(nx, -70, 70);
  b.z = clamp(nz, -70, 70);
  b.y += b.vy * dt;
  if (
    aquatic &&
    b.jetTime === 0 &&
    shore.inWater &&
    b.y > shore.level - SHORE.surfaceFloat
  ) {
    b.y = shore.level - SHORE.surfaceFloat;
    b.vy = Math.min(0, b.vy);
    b.mode = MODES.SWIM;
  }
  const ground = env.sample(b.x, b.z).height;
  const travelled = Math.hypot(b.x - ox, b.z - oz);
  const followsSlope =
    wasGrounded &&
    !aquatic &&
    b.jetTime === 0 &&
    b.vy <= 0 &&
    floor.height - ground <= travelled * Math.tan(Math.PI / 4) + 0.015 &&
    Math.hypot(floor.dx, floor.dz) <= 1;
  if (b.y <= ground || followsSlope) {
    b.y = ground;
    b.vy = 0;
    b.grounded = true;
  } else b.grounded = false;
  b.distance += Math.hypot(b.x - ox, b.z - oz);
  if (!Number.isFinite(b.y) || b.y < -30) {
    b.y = ground;
    b.vy = 0;
    b.vx = 0;
    b.vz = 0;
    b.mode = MODES.LAND;
  }
}
