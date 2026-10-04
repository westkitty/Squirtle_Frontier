import { clamp, hash2i } from "../rng.js";
import {
  ECOTYPES,
  HABITATS,
} from "./squirtle-ecology.js";

export const MAX_NEAR_CONSPECIFICS = 3;
export const MAX_CONSPECIFIC_TRACES = 8;
const ACTIVE_RADIUS2 = 28 * 28,
  SENSE_RADIUS2 = 12 * 12,
  TRACE_INTERVAL = 2.2;

const tracePriority = Object.freeze({
  shucker: 7,
  danger: 6,
  human: 5,
  "safe-water": 4,
  home: 3,
  route: 2,
});

const traceMessage = Object.freeze({
  shucker:
    "A cut-metal scent crosses frightened shell-scrapes. Shucker evidence; nearby conspecific routes have gone quiet.",
  danger: "Fresh shell-scrapes break sharply toward cover. Another conspecific fled something here.",
  human: "Small tracks pause at the human edge, then double back through cover.",
  "safe-water": "Fresh webbed tracks linger at clean water. Another conspecific drank safely here.",
  home: "Layered shell and foot marks repeat here. This is used as a conspecific home reach.",
  route: "Faint webbed tracks form a repeated route through the ground cover.",
});

const notableFor = (memory, id) =>
  memory?.squirtles?.find((record) => record.id === id) ?? null;

export class NearConspecifics {
  constructor(seed = 1337) {
    this.seed = seed;
    this.actors = [];
    this.traces = [];
    this.traceWrite = 0;
    this.time = 0;
    this.signature = "";
    this.activeIds = [];
    this.reconcileRuns = 0;
    this.activeCount = 0;
  }

  leaveLocal() {
    this.activeCount = 0;
    this.activeIds.length = 0;
    for (const actor of this.actors) actor.active = false;
  }

  desiredCount(habitat, ecology) {
    if (!ecology?.habitatEligible(habitat)) return 0;
    const abundance = ecology.abundance[habitat.ecotype] ?? 0;
    if (abundance < habitat.spawnThreshold * 0.7) return 0;
    return Math.min(habitat.capacity, 1 + Number(abundance > 0.72));
  }

  actorId(habitat, slot) {
    const stamp = Math.floor(hash2i(slot + 1, habitat.id.length * 37, this.seed) * 4096)
      .toString(16)
      .padStart(3, "0");
    return `sq-${habitat.ecotype}-${habitat.id}-${slot}-${stamp}`;
  }

  makeActor(habitat, slot, memory) {
    const phase = hash2i(slot + 1, habitat.id.length * 19, this.seed) * Math.PI * 2,
      radius = 0.8 + hash2i(slot + 4, habitat.id.length * 23, this.seed) * 1.7,
      id = this.actorId(habitat, slot),
      remembered = notableFor(memory, id);
    return {
      id,
      ecotype: habitat.ecotype,
      habitatId: habitat.id,
      slot,
      marking: Math.floor(hash2i(slot + 7, habitat.id.length * 31, this.seed) * 4096),
      homeX: habitat.x,
      homeZ: habitat.z,
      homeRadius: habitat.radius,
      x: habitat.x + Math.sin(phase) * radius,
      z: habitat.z + Math.cos(phase) * radius,
      yaw: phase,
      vx: 0,
      vz: 0,
      phase,
      active: false,
      mode: "rest",
      cause: "none",
      thirst: hash2i(slot + 9, habitat.id.length * 41, this.seed) * 0.45,
      fear: remembered?.fear ?? 0,
      trust: remembered?.trust ?? 0,
      familiarity: remembered?.familiarity ?? 0,
      encounters: remembered?.encounters ?? 0,
      calmSeconds: 0,
      lastVisitTick: -1000,
      lastSeenTick: remembered?.lastSeen ?? -1000,
      traceClock: hash2i(slot + 11, habitat.id.length * 47, this.seed) * TRACE_INTERVAL,
    };
  }

  reconcile(ecology, memory, body, place) {
    const wanted = [], local = [];
    for (const habitat of HABITATS) {
      const dx = (body?.x ?? 0) - habitat.x,
        dz = (body?.z ?? 0) - habitat.z,
        nearby = place === "frontier" && dx * dx + dz * dz <= ACTIVE_RADIUS2;
      local.push(nearby ? 1 : 0);
      if (!nearby || !ecology?.habitatEligible(habitat)) continue;
      const normal = this.desiredCount(habitat, ecology);
      // Remembered individuals get first claim on a local slot while their habitat is safe.
      for (let slot = 0; slot < habitat.capacity && wanted.length < MAX_NEAR_CONSPECIFICS; slot++) {
        const id = this.actorId(habitat, slot);
        if (notableFor(memory, id)) wanted.push({ habitat, slot, id });
      }
      for (let slot = 0; slot < normal && wanted.length < MAX_NEAR_CONSPECIFICS; slot++) {
        const id = this.actorId(habitat, slot);
        if (!wanted.some((entry) => entry.id === id)) wanted.push({ habitat, slot, id });
      }
      if (wanted.length >= MAX_NEAR_CONSPECIFICS) break;
    }
    const ids = wanted.map((entry) => entry.id).join("|"),
      memoryIds = (memory?.squirtles ?? []).map((record) => record.id).join("|"),
      signature = `${ecology?.revision ?? 0}|${local.join("")}|${ids}|${memoryIds}`;
    if (signature === this.signature) return;
    this.signature = signature;
    this.reconcileRuns++;
    this.activeIds.length = 0;
    for (const wantedActor of wanted) {
      let actor = this.actors.find((candidate) => candidate.id === wantedActor.id);
      if (!actor) {
        actor = this.makeActor(wantedActor.habitat, wantedActor.slot, memory);
        this.actors.push(actor);
      }
      const remembered = notableFor(memory, actor.id);
      if (remembered) {
        actor.fear = remembered.fear;
        actor.trust = remembered.trust;
        actor.familiarity = remembered.familiarity;
        actor.encounters = remembered.encounters;
        actor.lastSeenTick = remembered.lastSeen;
      }
      this.activeIds.push(actor.id);
    }
  }

  writeTrace(actor, type, strength = 0.5) {
    const index = this.traceWrite++ % MAX_CONSPECIFIC_TRACES;
    const trace = this.traces[index] || (this.traces[index] = {});
    trace.id = `${actor.id}-${this.traceWrite}`;
    trace.type = type;
    trace.ecotype = actor.ecotype;
    trace.x = actor.x;
    trace.z = actor.z;
    trace.strength = clamp(strength, 0, 1);
    trace.time = this.time;
    if (this.traces.length > MAX_CONSPECIFIC_TRACES)
      this.traces.length = MAX_CONSPECIFIC_TRACES;
  }

  traceType(actor, env) {
    if (actor.cause === "shucker") return "shucker";
    if (actor.cause === "human") return "human";
    if (actor.mode === "flee" || actor.mode === "hide") return "danger";
    if (actor.mode === "drink") {
      const q = env?.drinkQuality;
      const clean = (1 - (q?.contamination ?? 0)) * (1 - (q?.sediment ?? 0) * 0.5);
      if (clean > 0.6) return "safe-water";
    }
    const homeDx = actor.x - actor.homeX,
      homeDz = actor.z - actor.homeZ;
    if (homeDx * homeDx + homeDz * homeDz < 1.2) return "home";
    return "route";
  }

  step(dt, body, place, ecology, memory, env) {
    if (!Number.isFinite(dt) || dt < 0 || dt > 0.1)
      throw new Error("Invalid nearby conspecific step");
    this.time += dt;
    this.reconcile(ecology, memory, body, place);
    this.activeCount = 0;
    const speed2 = (body?.vx ?? 0) ** 2 + (body?.vz ?? 0) ** 2,
      playerFast = speed2 > 16;
    const shuckerEvidence = ecology?.shuckerEvidence?.();

    for (const actor of this.actors) {
      actor.active = this.activeIds.includes(actor.id);
      if (!actor.active) continue;
      this.activeCount++;
      const type = ECOTYPES[actor.ecotype],
        oldX = actor.x,
        oldZ = actor.z,
        px = oldX - body.x,
        pz = oldZ - body.z,
        playerDist2 = px * px + pz * pz,
        trustEase = 1 - actor.trust * 0.62,
        avoid = type.avoidance * trustEase,
        jetAlarm = body.jetTime > 0 && playerDist2 < 64,
        slideAlarm = body.mode === "slide" && speed2 > 4 && playerDist2 < 36,
        rushAlarm = playerFast && playerDist2 < 20,
        closeAlarm = playerDist2 < avoid * avoid && actor.trust < 0.58;
      let dx = 0,
        dz = 0,
        moveSpeed = type.speed * 0.22;
      actor.cause = "none";
      actor.thirst = clamp(actor.thirst + dt * 0.035, 0, 1);

      if (ecology.shuckerPressure > 0.35) {
        actor.cause = "shucker";
        if (actor.ecotype === "marsh") {
          actor.mode = "hide";
          dx = actor.homeX - oldX;
          dz = actor.homeZ - oldZ;
          moveSpeed = 0.55;
        } else {
          actor.mode = "flee";
          dx = oldX - (shuckerEvidence?.x ?? actor.homeX + 2);
          dz = oldZ - (shuckerEvidence?.z ?? actor.homeZ + 2);
          moveSpeed = type.speed * 1.3;
        }
      } else if (jetAlarm || slideAlarm || rushAlarm || closeAlarm) {
        actor.cause = "player";
        if (actor.ecotype === "marsh" && !jetAlarm && playerDist2 > 2.25) {
          actor.mode = "hide";
          dx = actor.homeX - oldX;
          dz = actor.homeZ - oldZ;
          moveSpeed = 0.65;
        } else if (actor.ecotype === "urban" && actor.trust > 0.55 && !jetAlarm) {
          actor.mode = "watch";
          moveSpeed = 0;
        } else {
          actor.mode = "flee";
          dx = px;
          dz = pz;
          moveSpeed = type.speed * (actor.ecotype === "freshwater" ? 1.5 : 1.2);
        }
      } else if (ecology.humanPressure > 0.34 && actor.ecotype !== "urban") {
        actor.cause = "human";
        actor.mode = actor.ecotype === "marsh" ? "hide" : "return-home";
        dx = actor.homeX - oldX;
        dz = actor.homeZ - oldZ;
        moveSpeed = type.speed * 0.7;
      } else {
        const fromHomeX = oldX - actor.homeX,
          fromHomeZ = oldZ - actor.homeZ,
          homeDist2 = fromHomeX * fromHomeX + fromHomeZ * fromHomeZ;
        const waterAtHome = !!env?.water?.(actor.homeX, actor.homeZ);
        if (homeDist2 > 30) {
          actor.mode = "return-home";
          dx = -fromHomeX;
          dz = -fromHomeZ;
          moveSpeed = type.speed * 0.7;
        } else if (actor.thirst > 0.68 && waterAtHome) {
          const wx = actor.homeX - oldX,
            wz = actor.homeZ - oldZ,
            d2 = wx * wx + wz * wz;
          if (d2 < 0.22) {
            actor.mode = "drink";
            actor.thirst = clamp(actor.thirst - dt * 0.28, 0, 1);
            moveSpeed = 0;
          } else {
            actor.mode = "travel";
            dx = wx;
            dz = wz;
            moveSpeed = type.speed * 0.45;
          }
        } else if (actor.trust > 0.58 && playerDist2 < 20) {
          if (playerDist2 > 5) {
            actor.mode = "socialize";
            dx = body.x - oldX;
            dz = body.z - oldZ;
            moveSpeed = type.speed * 0.3;
          } else {
            actor.mode = "rest";
            // High trust permits relaxed orientation/back-turning instead of fixation.
            actor.yaw = body.yaw + Math.PI * (actor.trust > 0.78 ? 0.8 : 0.45);
            moveSpeed = 0;
          }
        } else {
          const cycle = Math.floor((this.time + actor.phase * 2) / 5) % 4;
          if (actor.ecotype === "urban" && cycle === 0) {
            actor.mode = "watch";
            moveSpeed = 0;
          } else if (actor.ecotype === "marsh" && cycle === 1) {
            actor.mode = "hide";
            dx = actor.homeX - oldX;
            dz = actor.homeZ - oldZ;
            moveSpeed = 0.28;
          } else if (cycle === 2) {
            actor.mode = "rest";
            moveSpeed = 0;
          } else {
            actor.mode = "forage";
            const angle = actor.phase + this.time * (actor.ecotype === "freshwater" ? 0.09 : 0.055);
            dx = actor.homeX + Math.sin(angle) * 2.3 - oldX;
            dz = actor.homeZ + Math.cos(angle) * 2.3 - oldZ;
            moveSpeed = type.speed * 0.22;
          }
        }
      }

      if (moveSpeed > 0) {
        const length = Math.hypot(dx, dz) || 1;
        actor.vx = (dx / length) * moveSpeed;
        actor.vz = (dz / length) * moveSpeed;
        let x = oldX + actor.vx * dt,
          z = oldZ + actor.vz * dt;
        for (const obstacle of env?.obstaclesAt?.(x, z) || env?.obstacles || []) {
          const ox = x - obstacle.x,
            oz = z - obstacle.z,
            radius = (obstacle.radius ?? 0) + 0.22,
            dist2 = ox * ox + oz * oz;
          if (dist2 >= radius * radius) continue;
          const dist = Math.sqrt(dist2);
          x = obstacle.x + (dist > 1e-5 ? ox / dist : 1) * radius;
          z = obstacle.z + (dist > 1e-5 ? oz / dist : 0) * radius;
        }
        const leashX = x - actor.homeX,
          leashZ = z - actor.homeZ,
          leash2 = leashX * leashX + leashZ * leashZ,
          limit = actor.homeRadius * actor.homeRadius;
        if (leash2 > limit) {
          const lengthHome = Math.sqrt(leash2) || 1,
            max = Math.sqrt(limit);
          x = actor.homeX + (leashX / lengthHome) * max;
          z = actor.homeZ + (leashZ / lengthHome) * max;
        }
        actor.x = x;
        actor.z = z;
        actor.yaw = Math.atan2(actor.vx, actor.vz);
      } else {
        actor.vx = 0;
        actor.vz = 0;
      }

      actor.traceClock += dt;
      if (actor.traceClock >= TRACE_INTERVAL) {
        actor.traceClock -= TRACE_INTERVAL;
        this.writeTrace(actor, this.traceType(actor, env), actor.mode === "flee" ? 0.9 : 0.55);
      }
    }
  }

  observe(body, memory, tick) {
    if (!memory || !Number.isSafeInteger(tick)) return;
    const alarming = body.jetTime > 0 || body.mode === "slide" || (body.vx ** 2 + body.vz ** 2) > 9;
    for (const actor of this.actors) {
      if (!actor.active) continue;
      const dx = actor.x - body.x,
        dz = actor.z - body.z;
      if (dx * dx + dz * dz > 25) continue;
      if (tick - actor.lastVisitTick >= 20) {
        actor.encounters = Math.min(10000, actor.encounters + 1);
        actor.lastVisitTick = tick;
      }
      actor.lastSeenTick = tick;
      actor.fear = clamp(actor.fear + (alarming ? 0.08 : -0.035), 0, 1);
      actor.trust = clamp(actor.trust + (alarming ? -0.035 : 0.035), 0, 1);
      actor.familiarity = clamp(actor.familiarity + (alarming ? 0.005 : 0.025), 0, 1);
      actor.calmSeconds = alarming ? 0 : Math.min(120, actor.calmSeconds + 1);
      const remembered = notableFor(memory, actor.id);
      if (
        remembered ||
        actor.encounters >= 2 ||
        actor.calmSeconds >= 10 ||
        actor.trust >= 0.45
      )
        memory.rememberConspecific(actor, tick);
    }
  }

  sense(body, ecology) {
    let best = null,
      bestScore = -Infinity;
    const consider = (trace) => {
      const dx = trace.x - body.x,
        dz = trace.z - body.z,
        d2 = dx * dx + dz * dz;
      if (d2 > SENSE_RADIUS2) return;
      const score = (tracePriority[trace.type] ?? 0) * 100 - d2;
      if (score > bestScore) {
        best = trace;
        bestScore = score;
      }
    };
    const evidence = ecology?.shuckerEvidence?.();
    if (evidence) consider(evidence);
    for (const trace of this.traces) if (trace) consider(trace);
    if (!best) return null;
    return {
      type: best.type,
      x: best.x,
      z: best.z,
      strength: best.strength ?? 0.5,
      message: traceMessage[best.type] ?? traceMessage.route,
    };
  }

  performanceStats() {
    return {
      actors: this.actors.length,
      active: this.activeCount,
      traces: this.traces.length,
      reconcileRuns: this.reconcileRuns,
    };
  }
}
