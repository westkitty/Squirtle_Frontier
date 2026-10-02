import * as THREE from "three";
const CLEARANCE = 0.12; // Greater than the .04 near-plane half-diagonal at supported aspects.
// Vertical look range, in radians of pitch. Kept narrow enough that the boom
// never clips the ground plane behind the body.
export const PITCH_LIMITS = Object.freeze({ min: -0.35, max: 0.85 });
const EPSILON = 1e-6;

// Earliest intersection of a boom with an inflated, finite-height cylinder.
function cylinderHit(from, to, obstacle, floor) {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    dz = to.z - from.z;
  const ox = from.x - obstacle.x,
    oz = from.z - obstacle.z,
    radius = obstacle.radius + CLEARANCE;
  const a = dx * dx + dz * dz,
    b = 2 * (ox * dx + oz * dz),
    c = ox * ox + oz * oz - radius * radius;
  let enter = 0,
    exit = 1;
  if (a < EPSILON) {
    if (c > 0) return 1;
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return 1;
    const root = Math.sqrt(discriminant);
    enter = Math.max(enter, (-b - root) / (2 * a));
    exit = Math.min(exit, (-b + root) / (2 * a));
  }
  const bottom = floor - CLEARANCE,
    top = floor + obstacle.height + CLEARANCE;
  if (Math.abs(dy) < EPSILON) {
    if (from.y < bottom || from.y > top) return 1;
  } else {
    const t1 = (bottom - from.y) / dy,
      t2 = (top - from.y) / dy;
    enter = Math.max(enter, Math.min(t1, t2));
    exit = Math.min(exit, Math.max(t1, t2));
  }
  return enter <= exit && exit >= 0 && enter <= 1 ? Math.max(0, enter) : 1;
}
export class CreatureCamera {
  constructor(camera, env) {
    this.camera = camera;
    this.env = env;
    this.yaw = Math.PI;
    this.pitch = 0.26;
    this.initial = true;
    this.impactRecoil = 0;
    this.target = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.probe = new THREE.Vector3();
  }
  constrain(from, to, blockers) {
    let fraction = 1;
    const length = from.distanceTo(to);
    for (const obstacle of blockers) {
      // Broad phase avoids terrain queries for distant cylinders.
      if (
        Math.hypot(from.x - obstacle.x, from.z - obstacle.z) >
        length + obstacle.radius + CLEARANCE
      )
        continue;
      const hit = cylinderHit(
        from,
        to,
        obstacle,
        this.env.sample(obstacle.x, obstacle.z).height,
      );
      if (hit < 1)
        fraction = Math.min(
          fraction,
          Math.max(0, hit - 0.025 / Math.max(length, 0.025)),
        );
    }
    const steps = Math.max(1, Math.ceil(length / 0.15));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (t > fraction) break;
      this.probe.copy(from).lerp(to, t);
      if (
        this.probe.y <
        this.env.sample(this.probe.x, this.probe.z).height + CLEARANCE
      ) {
        fraction = Math.min(fraction, (i - 1) / steps);
        break;
      }
    }
    to.lerpVectors(from, to, fraction);
    to.y = Math.max(to.y, this.env.sample(to.x, to.z).height + CLEARANCE);
  }
  // Orientation authority. Called by the simulation at the point where movement
  // direction is derived, so a look delta affects heading before it affects
  // anything that reads it - never a step later because the renderer was busy.
  // This is the ONLY writer of yaw/pitch that movement consumes.
  applyLook(look, settings) {
    const sensitivity = Number.isFinite(settings.sensitivity)
      ? settings.sensitivity
      : 1;
    if (look.x) this.yaw -= look.x * 0.004 * sensitivity;
    if (look.y)
      this.pitch = THREE.MathUtils.clamp(
        this.pitch + look.y * 0.003 * sensitivity * (settings.invertY ? -1 : 1),
        PITCH_LIMITS.min,
        PITCH_LIMITS.max,
      );
    this.lookedAt = (this.lookedAt || 0) + 1;
  }
  // Movement authority in world space: camera-relative intent for the body.
  heading() {
    return this.yaw;
  }
  update(body, dt, settings) {
    const speed = Math.hypot(body.vx, body.vz);
    const inSlide = body.mode === "slide";
    const inDive = body.mode === "dive" || body.y < -0.45;

    // Tactical micro-recoil on hard impacts (falling or collision)
    if (!settings.reducedMotion) {
      if (body.impact > 0.04) {
        this.impactRecoil = Math.min(0.08, body.impact * 0.12);
      }
      this.impactRecoil = THREE.MathUtils.damp(this.impactRecoil, 0, 14, dt);
    } else {
      this.impactRecoil = 0;
    }

    const slideBoost =
      inSlide && !settings.reducedMotion
        ? 0.35 + Math.min(speed, 5.0) * 0.07
        : 0;
    const distance = 2.1 + slideBoost;

    // Athletic slight look-ahead along travel velocity when sliding/sprinting
    const lead =
      !settings.reducedMotion && (inSlide || speed > 2.5)
        ? Math.min(speed, 5.0) * 0.04
        : 0;
    const leadX = speed > 0.1 ? (body.vx / speed) * lead : 0;
    const leadZ = speed > 0.1 ? (body.vz / speed) * lead : 0;

    this.target.set(
      body.x + leadX,
      body.y + 0.32 - this.impactRecoil,
      body.z + leadZ,
    );
    this.desired.set(
      this.target.x - Math.sin(this.yaw) * distance * Math.cos(this.pitch),
      this.target.y + Math.sin(this.pitch) * distance + 0.25,
      this.target.z - Math.cos(this.yaw) * distance * Math.cos(this.pitch),
    );
    const blockers =
      this.env.obstaclesAt?.(body.x, body.z) || this.env.obstacles;
    this.constrain(this.target, this.desired, blockers);
    this.camera.position.lerp(
      this.desired,
      this.initial ? 1 : 1 - Math.exp(-12 * dt),
    );
    this.initial = false;
    // Collision authority comes AFTER smoothing. A safe desired point alone isn't enough.
    this.constrain(this.target, this.camera.position, blockers);
    this.camera.lookAt(this.target);

    let fov = 55;
    if (settings.reducedMotion) {
      if (this.camera.fov !== 55) {
        this.camera.fov = 55;
        this.camera.updateProjectionMatrix();
      }
    } else {
      if (inDive) {
        fov = 61;
      } else if (inSlide) {
        fov = 55 + Math.min(speed, 5.0) * 1.1;
      }
      const next = THREE.MathUtils.damp(this.camera.fov, fov, 8, dt);
      if (Math.abs(this.camera.fov - next) > 0.001) {
        this.camera.fov = next;
        this.camera.updateProjectionMatrix();
      }
    }
  }
  movement(x, z) {
    return {
      x: x * -Math.cos(this.yaw) + z * Math.sin(this.yaw),
      z: x * Math.sin(this.yaw) + z * Math.cos(this.yaw),
    };
  }
  // The same authority, one dimension richer. Where the look pitch is allowed to
  // matter - truly swimming or diving - pointing the camera down is part of the
  // trajectory, and the horizontal drive shrinks as the intent steepens so angling
  // down trades forward speed for depth instead of adding free total speed.
  // `weight` is how much of the pitch the controller should obey: 1 in open water,
  // less near the surface, 0 wherever the body is standing on something.
  intent3(x, z, weight = 1) {
    const cp = Math.cos(this.pitch),
      sp = Math.sin(this.pitch),
      planar = this.movement(x, z),
      y = -sp * Math.hypot(x, z) * weight,
      // Fold the pitch in along the drive direction, not the camera's, so a body
      // angled across its own travel does not get pushed sideways by the look.
      drive = Math.min(1, Math.hypot(x, z)),
      vertical = y * drive,
      shrink = 1 - Math.min(0.45, Math.abs(vertical) * 0.45),
      length = Math.max(
        1,
        Math.hypot(planar.x * shrink, vertical, planar.z * shrink),
      );
    return {
      x: (planar.x * shrink) / length,
      y: vertical / length,
      z: (planar.z * shrink) / length,
      pitch: this.pitch,
    };
  }
}
