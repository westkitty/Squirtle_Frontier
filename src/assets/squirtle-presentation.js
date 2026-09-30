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
    this.shell = 0;
    // Collada SID -> semantic role verified against source node hierarchy.
    const roles = {
      joint1: "Head",
      joint3: "LArm",
      joint9: "LThigh",
      joint13: "RArm",
      joint19: "RThigh",
      joint23: "Tail1",
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
  present(b, dt) {
    this.phase += dt * Math.max(1, Math.hypot(b.vx, b.vz) * 8);
    const inShell = b.mode === "slide";
    this.shell += (Number(inShell) - this.shell) * (1 - Math.exp(-14 * dt));
    this.root.position.set(b.x, b.y, b.z);
    this.root.rotation.y = b.yaw;
    for (const { node, q, scale } of this.bones.values()) {
      node.quaternion.copy(q);
      node.scale.copy(scale);
    }
    const rotate = (name, amount) => {
      const bone = this.bones.get(name);
      if (bone) bone.node.rotateY(amount);
    };
    const gait =
      Math.sin(this.phase) *
      Math.min(0.3, Math.hypot(b.vx, b.vz) * 0.1) *
      (1 - this.shell);
    rotate("LThigh", gait);
    rotate("RThigh", -gait);
    rotate("LArm", -gait * 0.7);
    rotate("RArm", gait * 0.7);
    // New procedural poses; never represented as verified source animation clips.
    for (const name of ["Head", "LArm", "RArm", "LThigh", "RThigh", "Tail1"]) {
      const bone = this.bones.get(name);
      if (bone) bone.node.scale.multiplyScalar(1 - this.shell * 0.92);
    }
    const aquatic = b.mode === "swim" || b.mode === "dive";
    const targetTilt = inShell ? Math.PI / 2 : aquatic ? 0.85 : 0;
    this.visual.rotation.x = THREE.MathUtils.damp(
      this.visual.rotation.x,
      targetTilt,
      8,
      dt,
    );
    this.visual.position.y = inShell
      ? 0.21
      : aquatic
        ? 0.12
        : Math.abs(Math.sin(this.phase)) *
          Math.min(0.012, Math.hypot(b.vx, b.vz) * 0.004);
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
