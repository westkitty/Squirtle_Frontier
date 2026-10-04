import { clamp, hash2i } from "../rng.js";
export const WILDLIFE_HOME = Object.freeze({ x: -6, z: -15 });
export const MAX_PREY = 12,
  MAX_PREDATORS = 3;
// Behavior, not population: how much water there is, how clean it is and how close
// the player stands decide where the herd drinks. Counts stay with the ecosystem.
const THIRST_RATE = 0.09,
  DRINK_RATE = 0.35,
  DRINK_START = 0.55,
  DRINK_HELD = 2.2,
  PARCHED_AT = 0.85,
  FRONT_RECHECK = 1;
export function waterQuality(water) {
  if (!water) return 1;
  return (1 - (water.contamination ?? 0)) * (1 - (water.sediment ?? 0) * 0.5);
}
export class NearWildlife {
  constructor(seed = 1337) {
    this.seed = seed;
    this.actors = [];
    this.active = false;
    this.time = 0;
    this.sites = [];
    this.sitesAge = Infinity;
    this.drinkers = [];
    this.before = [];
    this.preyLimit = -1;
    this.predatorLimit = -1;
    this.reconcileRuns = 0;
    this.parched = false;
    this.waterIssue = null;
  }
  clear() {
    this.actors.length = 0;
    this.active = false;
    this.sites.length = 0;
    this.sitesAge = Infinity;
    this.drinkers.length = 0;
    this.before.length = 0;
    this.preyLimit = -1;
    this.predatorLimit = -1;
    this.parched = false;
    this.waterIssue = null;
  }
  // Wet edges are read from the same water predicate the body and camera trust,
  // so a shore an animal can drink at is a shore the player can wade at.
  findSites(env) {
    const sites = [];
    if (!env?.water) return sites;
    for (let k = 0; k < 16; k++) {
      const angle = (k / 16) * Math.PI * 2;
      for (let r = 1; r <= 6.5; r += 0.5) {
        const x = WILDLIFE_HOME.x + Math.cos(angle) * r,
          z = WILDLIFE_HOME.z + Math.sin(angle) * r;
        if (env.water(x, z)) {
          sites.push({ x, z });
          break;
        }
      }
    }
    return sites;
  }
  reconcile(prey, predators) {
    if (prey === this.preyLimit && predators === this.predatorLimit) return;
    this.reconcileRuns++;
    let write = 0;
    for (let i = 0; i < this.actors.length; i++) {
      const actor = this.actors[i],
        limit = actor.kind === "prey" ? prey : predators;
      if (actor.slot < limit) this.actors[write++] = actor;
    }
    this.actors.length = write;
    for (const [kind, limit] of [
      ["prey", prey],
      ["predator", predators],
    ]) {
      for (let slot = 0; slot < limit; slot++) {
        let exists = false;
        for (let i = 0; i < this.actors.length; i++) {
          const actor = this.actors[i];
          if (actor.kind === kind && actor.slot === slot) {
            exists = true;
            break;
          }
        }
        if (exists) continue;
        const phase =
            hash2i(slot, kind === "prey" ? 91 : 92, this.seed) * Math.PI * 2,
          radius = kind === "prey" ? 1.5 + slot * 0.2 : 5;
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
          // Staggered so a herd does not drink as one animal.
          thirst: kind === "prey" ? hash2i(slot, 93, this.seed) * 0.4 : 0,
          drink: 0,
        });
      }
    }
    this.preyLimit = prey;
    this.predatorLimit = predators;
  }
  snapshotActors() {
    for (let i = 0; i < this.actors.length; i++) {
      const actor = this.actors[i],
        snap = this.before[i] || (this.before[i] = {});
      snap.kind = actor.kind;
      snap.slot = actor.slot;
      snap.x = actor.x;
      snap.z = actor.z;
      snap.yaw = actor.yaw;
      snap.mode = actor.mode;
      snap.phase = actor.phase;
      snap.vx = actor.vx;
      snap.vz = actor.vz;
      snap.thirst = actor.thirst;
      snap.drink = actor.drink;
    }
    this.before.length = this.actors.length;
    return this.before;
  }
  snapshotFor(kind, slot) {
    for (let i = 0; i < this.before.length; i++) {
      const actor = this.before[i];
      if (actor.kind === kind && actor.slot === slot) return actor;
    }
    return null;
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
    if (this.sitesAge >= FRONT_RECHECK) {
      this.sites = this.findSites(env);
      this.sitesAge = 0;
    } else this.sitesAge += dt;
    const water = env?.drinkQuality;
    const quality = waterQuality(water);
    // A shore the animals will use needs water in it, not just a depression.
    const drinkable =
      !!this.sites.length && quality > 0.5 && (water?.wetness ?? 1) > 0.25;
    this.waterIssue = drinkable
      ? null
      : !this.sites.length
        ? "gone"
        : quality <= 0.5
          ? "fouled"
          : "dry";
    // Decisions sample one reusable beginning-of-step snapshot, independent of array order.
    const before = this.snapshotActors();
    let parched = false;
    for (const a of this.actors) {
      const old = this.snapshotFor(a.kind, a.slot);
      let dx = 0,
        dz = 0,
        speed = 0.22;
      a.mode = "forage";
      // A drink does not survive the water going bad underneath it.
      a.drink = drinkable ? Math.max(0, old.drink - dt) : 0;
      a.thirst = clamp(old.thirst + dt * THIRST_RATE, 0, 1);
      const playerDistance = Math.hypot(old.x - body.x, old.z - body.z);
      if (
        playerDistance < (body.jetTime > 0 ? 6 : body.mode === "slide" ? 4 : 2)
      ) {
        dx = old.x - body.x;
        dz = old.z - body.z;
        speed = a.kind === "prey" ? 1.8 : 1.4;
        a.mode = "evade";
        a.drink = 0; // a flush interrupts a drink rather than queueing one
      } else if (a.kind === "prey") {
        let hunter = null,
          hunterDist2 = Infinity;
        for (let i = 0; i < before.length; i++) {
          const candidate = before[i];
          if (candidate.kind !== "predator") continue;
          const hx = candidate.x - old.x,
            hz = candidate.z - old.z,
            dist2 = hx * hx + hz * hz;
          if (dist2 < hunterDist2) {
            hunterDist2 = dist2;
            hunter = candidate;
          }
        }
        if (hunter && hunterDist2 < 9) {
          dx = old.x - hunter.x;
          dz = old.z - hunter.z;
          speed = 1.3;
          a.mode = "flee";
          a.drink = 0;
        } else if (old.drink > 0 && drinkable) {
          a.mode = "drink";
          a.thirst = clamp(old.thirst - dt * DRINK_RATE, 0, 1);
          speed = 0;
        } else if (drinkable && old.thirst > DRINK_START) {
          const site = this.sites[(old.slot * 5 + 7) % this.sites.length];
          dx = site.x - old.x;
          dz = site.z - old.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.4) {
            a.drink = DRINK_HELD;
            a.mode = "drink";
            speed = 0;
            dx = dz = 0;
          } else {
            speed = 0.55;
            a.mode = "seek-water";
          }
        } else if (!drinkable && old.thirst > PARCHED_AT) {
          // Thirst with nowhere safe to drink reads as pacing, not as an idle animal.
          a.mode = "parched";
          parched = true;
        }
      } else {
        let target = null,
          targetDist2 = Infinity;
        for (let i = 0; i < before.length; i++) {
          const candidate = before[i];
          if (candidate.kind !== "prey") continue;
          const qx = candidate.x - old.x,
            qz = candidate.z - old.z,
            dist2 = qx * qx + qz * qz;
          if (dist2 < targetDist2) {
            targetDist2 = dist2;
            target = candidate;
          }
        }
        if (target) {
          dx = target.x - old.x;
          dz = target.z - old.z;
          const d = Math.sqrt(targetDist2);
          // Drinking prey are committed and slower to notice, so they are stalked.
          const hold = target.mode === "drink" ? 2.2 : 0.5;
          speed = d > hold ? (target.mode === "drink" ? 0.5 : 0.7) : 0;
          a.mode = speed
            ? target.mode === "drink"
              ? "ambush"
              : "stalk"
            : "watch";
        }
      }
      if (a.mode === "forage" || a.mode === "parched") {
        const angle = a.phase + this.time * (a.mode === "parched" ? 0.5 : 0.08);
        dx = WILDLIFE_HOME.x + Math.cos(angle) * 2.5 - old.x;
        dz = WILDLIFE_HOME.z + Math.sin(angle) * 2.5 - old.z;
        if (a.mode === "parched") speed = 0.4;
      }
      if (speed > 0 && a.mode !== "drink") {
        let separateX = 0,
          separateZ = 0;
        for (const peer of before) {
          if (peer.kind !== old.kind || peer.slot === old.slot) continue;
          const px = old.x - peer.x,
            pz = old.z - peer.z,
            distance2 = px * px + pz * pz,
            radius = old.kind === "prey" ? 0.72 : 0.95;
          if (distance2 >= radius * radius) continue;
          const distance = Math.sqrt(distance2),
            weight = (radius - distance) / radius;
          if (distance > 1e-5) {
            separateX += (px / distance) * weight;
            separateZ += (pz / distance) * weight;
          } else {
            const sign = old.slot < peer.slot ? -1 : 1;
            separateX += sign * weight;
            separateZ -= sign * weight * 0.5;
          }
        }
        dx += separateX * 0.9;
        dz += separateZ * 0.9;
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
    let drinkerCount = 0;
    for (let i = 0; i < this.actors.length; i++) {
      const actor = this.actors[i];
      if (actor.mode !== "drink") continue;
      const point =
        this.drinkers[drinkerCount] ||
        (this.drinkers[drinkerCount] = { x: 0, z: 0 });
      point.x = actor.x;
      point.z = actor.z;
      drinkerCount++;
    }
    this.drinkers.length = drinkerCount;
    this.parched = parched;
    if (drinkable) this.waterIssue = null;
  }
  performanceStats() {
    return {
      actors: this.actors.length,
      snapshots: this.before.length,
      reconcileRuns: this.reconcileRuns,
      drinkers: this.drinkers.length,
    };
  }
}
