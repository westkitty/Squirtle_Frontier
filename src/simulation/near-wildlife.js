import { clamp, hash2i } from "../rng.js";
export const WILDLIFE_HOME = Object.freeze({ x: -6, z: -15 });
export const MAX_PREY = 12,
  MAX_PREDATORS = 3;
// Bounded near-only semantic agents. No rendering, timers or persistent identity per spawn.
// Aggregate population dynamics remain authoritative; local pursuit is not a second mortality model.
export class NearWildlife {
  constructor(seed = 1337) {
    this.seed = seed;
    this.actors = [];
    this.active = false;
    this.time = 0;
  }
  clear() {
    this.actors.length = 0;
    this.active = false;
  }
  reconcile(prey, predators) {
    for (const [kind, limit] of [
      ["prey", prey],
      ["predator", predators],
    ]) {
      this.actors = this.actors.filter(
        (a) => a.kind !== kind || a.slot < limit,
      );
      for (let slot = 0; slot < limit; slot++)
        if (!this.actors.some((a) => a.kind === kind && a.slot === slot)) {
          const phase =
            hash2i(slot, kind === "prey" ? 91 : 92, this.seed) * Math.PI * 2;
          const radius = kind === "prey" ? 1.5 + slot * 0.2 : 5;
          this.actors.push({
            kind,
            slot,
            x: WILDLIFE_HOME.x + Math.cos(phase) * radius,
            z: WILDLIFE_HOME.z + Math.sin(phase) * radius,
            yaw: phase,
            mode: "forage",
            phase,
            vx: 0,
            vz: 0,
          });
        }
    }
  }
  step(dt, body, place, ecosystem, env) {
    if (!Number.isFinite(dt) || dt < 0 || dt > 0.1)
      throw new Error("Invalid local wildlife step");
    if (
      place !== "frontier" ||
      Math.hypot(body.x - WILDLIFE_HOME.x, body.z - WILDLIFE_HOME.z) > 28
    ) {
      this.clear();
      return;
    }
    this.active = true;
    this.time += dt;
    this.reconcile(
      Math.floor(clamp(ecosystem.prey, 0, 1) * MAX_PREY),
      Math.floor(clamp(ecosystem.predators, 0, 1) * MAX_PREDATORS),
    );
    // Decisions sample a single immutable beginning-of-step snapshot, independent of array order.
    const before = this.actors.map((a) => ({ ...a }));
    for (const a of this.actors) {
      const old = before.find((b) => b.kind === a.kind && b.slot === a.slot);
      let dx = 0,
        dz = 0,
        speed = 0.22;
      a.mode = "forage";
      const playerDistance = Math.hypot(old.x - body.x, old.z - body.z);
      if (
        playerDistance < (body.jetTime > 0 ? 6 : body.mode === "slide" ? 4 : 2)
      ) {
        dx = old.x - body.x;
        dz = old.z - body.z;
        speed = a.kind === "prey" ? 1.8 : 1.4;
        a.mode = "evade";
      } else if (a.kind === "prey") {
        const hunter = before
          .filter((b) => b.kind === "predator")
          .sort(
            (l, r) =>
              Math.hypot(l.x - old.x, l.z - old.z) -
              Math.hypot(r.x - old.x, r.z - old.z),
          )[0];
        if (hunter && Math.hypot(hunter.x - old.x, hunter.z - old.z) < 3) {
          dx = old.x - hunter.x;
          dz = old.z - hunter.z;
          speed = 1.3;
          a.mode = "flee";
        }
      } else {
        const target = before
          .filter((b) => b.kind === "prey")
          .sort(
            (l, r) =>
              Math.hypot(l.x - old.x, l.z - old.z) -
              Math.hypot(r.x - old.x, r.z - old.z),
          )[0];
        if (target) {
          dx = target.x - old.x;
          dz = target.z - old.z;
          speed = Math.hypot(dx, dz) > 0.5 ? 0.7 : 0;
          a.mode = speed ? "stalk" : "watch";
        }
      }
      if (a.mode === "forage") {
        const angle = a.phase + this.time * 0.08;
        dx = WILDLIFE_HOME.x + Math.cos(angle) * 2.5 - old.x;
        dz = WILDLIFE_HOME.z + Math.sin(angle) * 2.5 - old.z;
      }
      const length = Math.hypot(dx, dz);
      if (length < 1e-6) {
        dx = Math.sin(a.phase);
        dz = Math.cos(a.phase);
      }
      const norm = Math.hypot(dx, dz) || 1;
      a.vx = (dx / norm) * speed;
      a.vz = (dz / norm) * speed;
      let x = old.x + a.vx * dt,
        z = old.z + a.vz * dt;
      const range = Math.hypot(x - WILDLIFE_HOME.x, z - WILDLIFE_HOME.z);
      if (range > 7) {
        x = WILDLIFE_HOME.x + ((x - WILDLIFE_HOME.x) * 7) / range;
        z = WILDLIFE_HOME.z + ((z - WILDLIFE_HOME.z) * 7) / range;
      }
      for (const o of env.obstaclesAt?.(x, z) || env.obstacles || []) {
        const ox = x - o.x,
          oz = z - o.z,
          d = Math.hypot(ox, oz),
          radius = o.radius + 0.18;
        if (d < radius) {
          x = o.x + (d > 1e-6 ? ox / d : 1) * radius;
          z = o.z + (d > 1e-6 ? oz / d : 0) * radius;
        }
      }
      a.x = x;
      a.z = z;
      if (speed > 0) a.yaw = Math.atan2(a.vx, a.vz);
    }
  }
}
