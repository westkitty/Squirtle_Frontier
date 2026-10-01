import * as THREE from "three";
import { PlayableCreature } from "./playable-creature-adapter.js";
export class SquirtlePresentation extends PlayableCreature {
  static async create(assets) {
    const handle = await assets.acquire("playable.squirtle");
    return new SquirtlePresentation(assets, handle);
  }
  constructor(assets, handle) {
    super();
    this.assets = assets;
    this.handle = handle;
    this.visual = new THREE.Group();
    this.root.add(this.visual);
    this.visual.add(handle.root);
    this.bones = new Map();
    this.materials = [];
    this.phase = 0;
    this.swimPhase = 0;
    this.breathPhase = 0;
    this.idleTime = 0;
    this.shakeTime = 0;
    this.wasAquatic = false;
    this.shell = 0;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.attentionTime = 0;
    this.activeAttention = null;
    this.restProgress = 0;
    // Collada SID -> semantic role verified against source node hierarchy.
    const roles = {
      joint1: "Head",
      joint2: "Snout",
      joint3: "LArm",
      joint4: "LForearm",
      joint9: "LThigh",
      joint10: "LCalf",
      joint13: "RArm",
      joint14: "RForearm",
      joint19: "RThigh",
      joint20: "RCalf",
      joint23: "Tail1",
      joint24: "Tail2",
      joint25: "Tail3",
    };
    handle.root.traverse((o) => {
      if (o.isBone)
        this.bones.set(roles[o.name] || o.name, {
          node: o,
          q: o.quaternion.clone(),
          scale: o.scale.clone(),
        });
      if (o.isMesh) {
        o.frustumCulled = false;
        const materials = (
          Array.isArray(o.material) ? o.material : [o.material]
        ).map((m) => {
          const own = m.clone();
          this.materials.push(own);
          return own;
        });
        o.material = Array.isArray(o.material) ? materials : materials[0];
      }
    });
  }
  get isLiving() {
    return true;
  }
  get isShaking() {
    return this.shakeTime > 0;
  }
  get idleDuration() {
    return this.idleTime;
  }
  get shellRetraction() {
    return this.shell;
  }
  get swimStroke() {
    return this.swimPhase;
  }
  get gazeYaw() {
    return this.lookYaw;
  }
  get gazePitch() {
    return this.lookPitch;
  }
  get attention() {
    return this.activeAttention;
  }
  get isSleeping() {
    return this.restProgress > 0.45;
  }
  get sleepProgress() {
    return this.restProgress;
  }
  present(b, dt, attentionTarget = null) {
    const aquatic = b.mode === "swim" || b.mode === "dive";
    const speed = Math.hypot(b.vx, b.vz);
    const isMoving = speed > 0.08;
    const inShell = b.mode === "slide";

    // Water exit detection: stepping out of water triggers a brief water-shedding shake
    if (this.wasAquatic && !aquatic && b.grounded) {
      this.shakeTime = 0.6;
    }
    this.wasAquatic = aquatic;
    this.shakeTime = Math.max(0, this.shakeTime - dt);

    // Idle duration and rest/sleep tracking on dry land
    if (!isMoving && b.grounded && !aquatic && !inShell) {
      this.idleTime += dt;
    } else {
      this.idleTime = 0;
    }

    const isResting =
      (b.resting || this.idleTime > 5.5) &&
      b.grounded &&
      !inShell &&
      !aquatic &&
      !isMoving;
    this.restProgress +=
      ((isResting ? 1 : 0) - this.restProgress) * (1 - Math.exp(-3.5 * dt));

    // Kinematic phase progressions
    this.phase += dt * Math.max(1, speed * 8);
    this.swimPhase += dt * (aquatic ? (isMoving ? 6.2 : 2.5) : 0);
    const breathRate = 2.2 * (1 - this.restProgress * 0.65);
    this.breathPhase += dt * breathRate;
    this.shell += (Number(inShell) - this.shell) * (1 - Math.exp(-14 * dt));

    this.root.position.set(b.x, b.y, b.z);
    this.root.rotation.y = b.yaw;

    // Reset bones to base rest pose before applying procedural kinematics
    for (const { node, q, scale } of this.bones.values()) {
      node.quaternion.copy(q);
      node.scale.copy(scale);
    }

    const rotateX = (name, amount) => {
      const bone = this.bones.get(name);
      if (bone) bone.node.rotateX(amount);
    };
    const rotateY = (name, amount) => {
      const bone = this.bones.get(name);
      if (bone) bone.node.rotateY(amount);
    };
    const rotateZ = (name, amount) => {
      const bone = this.bones.get(name);
      if (bone) bone.node.rotateZ(amount);
    };

    // Contextual attention & gaze tracking
    if (inShell || this.restProgress > 0.45) {
      // Complete suppression in shell slide or peaceful slumber
      this.lookYaw = 0;
      this.lookPitch = 0;
      this.attentionTime = 0;
      this.activeAttention = null;
    } else if (b.jetTime > 0 || speed > 2.2) {
      // Forward focus during high-speed travel or jet launch
      this.lookYaw += (0 - this.lookYaw) * (1 - Math.exp(-8 * dt));
      this.lookPitch += (0 - this.lookPitch) * (1 - Math.exp(-8 * dt));
      this.attentionTime = 0;
      this.activeAttention = null;
    } else if (attentionTarget) {
      this.attentionTime += dt;
      this.activeAttention = attentionTarget;
      const dx = attentionTarget.x - b.x;
      const dz = attentionTarget.z - b.z;
      const distH = Math.max(0.1, Math.hypot(dx, dz));
      const targetYaw = Math.atan2(dx, dz);
      const rawYawDiff = Math.atan2(
        Math.sin(targetYaw - b.yaw),
        Math.cos(targetYaw - b.yaw),
      );
      const targetY = attentionTarget.y !== undefined ? attentionTarget.y : b.y;
      const dy = targetY - (b.y + 0.32);
      const rawPitchDiff = Math.atan2(dy, distH);

      // Anatomical clamping: Squirtle neck/head physiological rotation bounds
      const clampedYaw = Math.max(-0.85, Math.min(0.85, rawYawDiff));
      const clampedPitch = Math.max(-0.38, Math.min(0.45, rawPitchDiff));

      // Saccadic approach and fixation
      this.lookYaw += (clampedYaw - this.lookYaw) * (1 - Math.exp(-5.5 * dt));
      this.lookPitch += (clampedPitch - this.lookPitch) * (1 - Math.exp(-5.5 * dt));
    } else {
      this.attentionTime = 0;
      this.activeAttention = null;
      this.lookYaw += (0 - this.lookYaw) * (1 - Math.exp(-4 * dt));
      this.lookPitch += (0 - this.lookPitch) * (1 - Math.exp(-4 * dt));
    }

    if (aquatic && !inShell) {
      if (b.jetTime > 0) {
        // Hydrodynamic Water Jet streamline posture
        rotateX("Head", 0.15);
        rotateZ("LArm", -0.45);
        rotateZ("RArm", 0.45);
        rotateY("LArm", -0.5);
        rotateY("RArm", -0.5);
        rotateY("LThigh", -0.35);
        rotateY("RThigh", -0.35);
        rotateX("Tail1", 0.1);
        rotateX("Tail2", 0.05);
      } else if (isMoving) {
        // Aquatic forward breaststroke and flutter propulsion
        const stroke = Math.sin(this.swimPhase);
        const power = Math.max(0, stroke);
        const recovery = Math.min(0, stroke);

        rotateY("LArm", stroke * 0.45);
        rotateY("RArm", stroke * 0.45);
        rotateZ("LArm", -0.2 - power * 0.35 + recovery * 0.2);
        rotateZ("RArm", 0.2 + power * 0.35 - recovery * 0.2);
        rotateY("LForearm", stroke * 0.25);
        rotateY("RForearm", stroke * 0.25);

        const kick = Math.cos(this.swimPhase);
        rotateY("LThigh", kick * 0.35);
        rotateY("RThigh", -kick * 0.35);
        rotateY("LCalf", Math.abs(kick) * 0.2);
        rotateY("RCalf", Math.abs(kick) * 0.2);

        // Fluid S-curve tail rudder
        const rudder = Math.sin(this.swimPhase + 0.8) * 0.28;
        rotateY("Tail1", rudder * 0.6);
        rotateY("Tail2", rudder * 0.9);
        rotateY("Tail3", rudder * 1.2);
        rotateX("Head", 0.12 + Math.sin(this.swimPhase) * 0.05);
      } else {
        // Treading water (buoyant gentle paddle & tail drift)
        const tread = Math.sin(this.swimPhase);
        rotateY("LArm", tread * 0.18 - 0.1);
        rotateY("RArm", tread * 0.18 - 0.1);
        rotateZ("LArm", -0.2 + tread * 0.08);
        rotateZ("RArm", 0.2 - tread * 0.08);
        rotateY("LThigh", Math.cos(this.swimPhase) * 0.15);
        rotateY("RThigh", -Math.cos(this.swimPhase) * 0.15);
        rotateY("Tail1", Math.sin(this.swimPhase * 0.7) * 0.15);
        rotateY("Tail2", Math.sin(this.swimPhase * 0.7 + 0.5) * 0.2);
        rotateX("Head", 0.15 + tread * 0.04);
        if (this.activeAttention) {
          rotateY("Head", this.lookYaw);
          rotateX("Head", this.lookPitch);
        }
      }
    } else if (!inShell && b.grounded) {
      if (isMoving) {
        // Terrestrial quadrupedal/bipedal gait with arm & tail counter-sway
        const gait =
          Math.sin(this.phase) * Math.min(0.3, speed * 0.1) * (1 - this.shell);
        rotateY("LThigh", gait);
        rotateY("RThigh", -gait);
        rotateY("LArm", -gait * 0.7);
        rotateY("RArm", gait * 0.7);
        rotateY("LForearm", -gait * 0.35);
        rotateY("RForearm", gait * 0.35);
        rotateY("Tail1", -gait * 0.4);
        rotateY("Tail2", -gait * 0.3);
        if (this.activeAttention) {
          rotateY("Head", this.lookYaw * 0.5);
          rotateX("Head", this.lookPitch * 0.5);
        }
      } else {
        // Living idle respiration & natural tail sway, relaxing into restful slumber
        const breath = Math.sin(this.breathPhase);
        const rest = this.restProgress;
        const alertWeight = 1 - rest;

        // Head and snout: nods with breath, settles into resting nap posture
        rotateX("Head", breath * (0.035 * alertWeight + 0.015 * rest) - rest * 0.22);
        rotateX("Snout", -rest * 0.07);

        // Arms: soft natural resting posture alongside plastron
        rotateZ("LArm", -0.18 + breath * 0.02 * alertWeight - rest * 0.22);
        rotateZ("RArm", 0.18 - breath * 0.02 * alertWeight + rest * 0.22);
        rotateX("LArm", rest * 0.28);
        rotateX("RArm", rest * 0.28);
        rotateY("LArm", -0.12);
        rotateY("RArm", -0.12);
        rotateY("LForearm", rest * 0.26);
        rotateY("RForearm", -rest * 0.26);

        // Legs: comfortable resting sit/crouch
        rotateZ("LThigh", rest * 0.32);
        rotateZ("RThigh", -rest * 0.32);
        rotateY("LThigh", rest * 0.22);
        rotateY("RThigh", -rest * 0.22);
        rotateY("LCalf", rest * 0.38);
        rotateY("RCalf", rest * 0.38);

        // Tail: gentle sway while alert, curls into protective resting crescent when sleeping
        const tailSway = Math.sin(this.breathPhase * 0.8) * 0.18;
        rotateY("Tail1", tailSway * 0.6 * alertWeight + rest * 0.48);
        rotateY("Tail2", tailSway * 0.8 * alertWeight + rest * 0.72);
        rotateY("Tail3", tailSway * alertWeight + rest * 0.96);
        rotateX("Tail1", -rest * 0.12);

        // Curious idle glance after settling or focused attention (alert state only)
        if (this.activeAttention && alertWeight > 0.5) {
          rotateY("Head", this.lookYaw);
          rotateX("Head", this.lookPitch);
          rotateZ("Head", Math.sin(this.attentionTime * 2.0) * 0.05);
          rotateX("Snout", this.lookPitch * 0.25);
        } else if (this.idleTime > 1.5 && alertWeight > 0.5) {
          const lookCycle = (this.idleTime - 1.5) * 0.6;
          const lookYaw =
            Math.sin(lookCycle) * Math.min(0.38, (this.idleTime - 1.5) * 0.2);
          rotateY("Head", lookYaw * alertWeight);
          rotateZ("Head", Math.sin(lookCycle * 0.5) * 0.08 * alertWeight);
        }
      }

      // Water shake-off when emerging from water
      if (this.shakeTime > 0) {
        const shakeIntensity = this.shakeTime / 0.6;
        const shake = Math.sin(this.shakeTime * 42) * 0.32 * shakeIntensity;
        rotateY("Head", shake);
        rotateY("Tail1", -shake * 1.2);
        rotateY("Tail2", -shake * 1.5);
        rotateY("Tail3", -shake * 1.8);
        rotateZ("LArm", shake * 0.5);
        rotateZ("RArm", -shake * 0.5);
      }
    } else if (!inShell && b.jetTime > 0) {
      // Land Water Jet launch posture
      rotateX("Head", 0.2);
      rotateY("LArm", -0.4);
      rotateY("RArm", -0.4);
      rotateZ("LArm", -0.3);
      rotateZ("RArm", 0.3);
      rotateY("LThigh", -0.3);
      rotateY("RThigh", -0.3);
      rotateX("Tail1", 0.15);
    }

    // Retract extremities cleanly into shell when sliding
    const shellRetract = 1 - this.shell * 0.92;
    for (const name of [
      "Head",
      "Snout",
      "LArm",
      "RArm",
      "LForearm",
      "RForearm",
      "LThigh",
      "RThigh",
      "LCalf",
      "RCalf",
      "Tail1",
      "Tail2",
      "Tail3",
    ]) {
      const bone = this.bones.get(name);
      if (bone) bone.node.scale.multiplyScalar(shellRetract);
    }

    const targetTilt = inShell
      ? Math.PI / 2
      : aquatic
        ? b.mode === "dive"
          ? 0.95
          : 0.82
        : 0;
    this.visual.rotation.x = THREE.MathUtils.damp(
      this.visual.rotation.x,
      targetTilt,
      8,
      dt,
    );

    // Tactile impact wobble in shell
    this.visual.rotation.z =
      inShell && b.impact > 0 ? Math.sin(b.impact * 40) * 0.18 : 0;

    this.visual.position.y = inShell
      ? 0.21
      : aquatic
        ? 0.12 + Math.sin(this.swimPhase) * (isMoving ? 0.018 : 0.01)
        : isMoving
          ? Math.abs(Math.sin(this.phase)) * Math.min(0.012, speed * 0.004)
          : Math.sin(this.breathPhase) * 0.003 - this.restProgress * 0.08;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    super.dispose();
    for (const m of this.materials) m.dispose();
    this.handle.root.traverse((o) => o.skeleton?.dispose());
    this.assets.release(this.handle);
  }
}
