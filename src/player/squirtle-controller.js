// Body-state authority: no Three.js, imported nodes, material names or animation dependencies.
import { clamp } from "../rng.js";
const approach = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
export function stepBody(b, input, env, dt) {
  b.jetCooldown = Math.max(0, b.jetCooldown - dt);
  b.jetTime = Math.max(0, b.jetTime - dt);
  b.impact = Math.max(0, b.impact - dt);
  const floor = env.sample(b.x, b.z),
    water = env.water(b.x, b.z);
  const immersed =
    water && b.y < water.level + 0.12 && water.level - floor.height > 0.4;
  const moving = Math.hypot(input.x, input.z) > 0.08;
  if (immersed && b.jetTime === 0) {
    b.mode =
      input.dive || (b.mode === "dive" && b.y < water.level - 0.2)
        ? "dive"
        : "swim";
  } else if (b.grounded) {
    if (input.slide) {
      if (b.mode !== "slide") {
        b.vx += Math.sin(b.yaw) * 3;
        b.vz += Math.cos(b.yaw) * 3;
      }
      b.mode = "slide";
    } else b.mode = "land";
  } else if (!immersed) b.mode = "air";
  const aquatic = b.mode === "swim" || b.mode === "dive";
  const speed = aquatic ? 4.8 : input.run ? 3.8 : 2.2;
  if (moving) {
    const target = Math.atan2(input.x, input.z),
      delta = Math.atan2(Math.sin(target - b.yaw), Math.cos(target - b.yaw));
    b.yaw += delta * (1 - Math.exp(-(b.mode === "slide" ? 5 : 12) * dt));
  }
  if (b.mode === "slide") {
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
  } else {
    const rate =
      b.jetTime > 0
        ? 0.3
        : aquatic
          ? 3.4
          : b.grounded
            ? moving
              ? 10
              : 14
            : 1.1;
    b.vx = approach(
      b.vx,
      input.x * speed + (aquatic ? water.currentX : 0),
      rate,
      dt,
    );
    b.vz = approach(
      b.vz,
      input.z * speed + (aquatic ? water.currentZ : 0),
      rate,
      dt,
    );
  }
  if (input.jet && b.jetCooldown <= 0) {
    b.jetCooldown = 1.1;
    b.jetTime = 0.36;
    b.vx += Math.sin(b.yaw) * 7.8;
    b.vz += Math.cos(b.yaw) * 7.8;
    b.vy = aquatic
      ? b.mode === "swim"
        ? 5
        : input.dive
          ? -2.5
          : input.ascend
            ? 3
            : 0
      : 3.2;
    b.grounded = false;
    if (b.mode === "swim") b.mode = "air";
  }
  const horizontal = Math.hypot(b.vx, b.vz);
  if (horizontal > 12) {
    b.vx *= 12 / horizontal;
    b.vz *= 12 / horizontal;
  }
  if (aquatic && b.jetTime === 0) {
    const vertical = input.dive
      ? -2.6
      : b.mode === "swim"
        ? (water.level - 0.22 - b.y) * 8
        : input.ascend
          ? 3
          : 0.08;
    b.vy = approach(b.vy, vertical, 5, dt);
    b.grounded = false;
  } else b.vy -= 12 * dt;
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
  if (aquatic && b.jetTime === 0 && water && b.y > water.level - 0.18) {
    b.y = water.level - 0.18;
    b.vy = Math.min(0, b.vy);
    b.mode = "swim";
  }
  const ground = env.sample(b.x, b.z).height;
  if (b.y <= ground) {
    b.y = ground;
    b.vy = 0;
    b.grounded = true;
  } else b.grounded = false;
  if (b.mode === "dive" && water && b.y >= water.level - 0.2 && !input.dive)
    b.mode = "swim";
  b.distance += Math.hypot(b.x - ox, b.z - oz);
  if (!Number.isFinite(b.y) || b.y < -30) {
    b.y = ground;
    b.vy = 0;
    b.vx = 0;
    b.vz = 0;
    b.mode = "land";
  }
}
