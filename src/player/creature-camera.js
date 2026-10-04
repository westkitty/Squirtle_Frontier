import * as THREE from "three";
const CLEARANCE = 0.12; // Greater than the .04 near-plane half-diagonal at supported aspects.
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
    this.lastBodyYaw = null;
    this.roll = 0;
    this.verticalLead = 0;
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
  update(body, input, dt, settings) {
    const lookYaw =
        input.lookX * 0.004 + (input.lookRateX || 0) * 2.25 * dt,
      lookPitch =
        input.lookY * 0.003 + (input.lookRateY || 0) * 1.8 * dt;
    this.yaw -= lookYaw * settings.sensitivity;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch +
        lookPitch *
          settings.sensitivity *
          (settings.invertY ? -1 : 1),
      -0.35,
      0.85,
    );

    const speed = Math.hypot(body.vx, body.vz);
    const inSlide = body.mode === "slide";
    const aquatic = body.mode === "swim" || body.mode === "dive";
    const inDive = body.mode === "dive" || body.y < -0.45;
    const inJet = body.jetTime > 0;
    const yawDelta =
        this.lastBodyYaw === null
          ? 0
          : Math.atan2(
              Math.sin(body.yaw - this.lastBodyYaw),
              Math.cos(body.yaw - this.lastBodyYaw),
            ),
      turnRate = yawDelta / Math.max(dt, 1 / 240);
    this.lastBodyYaw = body.yaw;
    this.verticalLead =
      !settings.reducedMotion && aquatic
        ? THREE.MathUtils.clamp(body.vy * 0.055, -0.16, 0.16)
        : 0;

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
      body.y + 0.32 - this.impactRecoil + this.verticalLead,
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

    const rollTarget =
      !settings.reducedMotion && (aquatic || inSlide) && speed > 0.25
        ? THREE.MathUtils.clamp(-turnRate * 0.02, -0.1, 0.1)
        : 0;
    this.roll = settings.reducedMotion
      ? 0
      : THREE.MathUtils.damp(this.roll, rollTarget, 8, dt);
    if (!settings.reducedMotion && Math.abs(this.roll) > 1e-5)
      this.camera.rotateZ(this.roll);

    let fov = 55;
    if (settings.reducedMotion) {
      if (this.camera.fov !== 55) {
        this.camera.fov = 55;
        this.camera.updateProjectionMatrix();
      }
    } else {
      if (inDive) {
        fov = 61;
      } else if (inJet) {
        fov = 59 + Math.min(speed, 8) * 0.2;
      } else if (inSlide) {
        fov = 55 + Math.min(speed, 5.0) * 1.1;
      } else if (speed > 3) {
        fov = 55 + Math.min(2.4, (speed - 3) * 0.9);
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
}
