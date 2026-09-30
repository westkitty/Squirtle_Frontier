import * as THREE from "three";
export class CreatureCamera {
  constructor(camera, env) {
    this.camera = camera;
    this.env = env;
    this.yaw = Math.PI;
    this.pitch = 0.26;
    this.initial = true;
    this.target = new THREE.Vector3();
  }
  update(b, input, dt, settings) {
    this.yaw -= input.lookX * 0.004 * settings.sensitivity;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + input.lookY * 0.003 * (settings.invertY ? -1 : 1),
      -0.35,
      0.85,
    );
    const underwater = b.y < -0.45;
    const distance =
      2.1 + (b.mode === "slide" && !settings.reducedMotion ? 0.35 : 0);
    const target = new THREE.Vector3(b.x, b.y + 0.32, b.z);
    const desired = new THREE.Vector3(
      target.x - Math.sin(this.yaw) * distance * Math.cos(this.pitch),
      target.y + Math.sin(this.pitch) * distance + 0.25,
      target.z - Math.cos(this.yaw) * distance * Math.cos(this.pitch),
    );
    // Sample the camera boom, shorten it before intersecting ground or collision proxies.
    const blockers = this.env.obstaclesAt?.(b.x, b.z) || this.env.obstacles;
    for (let t = 0.12; t <= 1; t += 0.08) {
      const p = target.clone().lerp(desired, t);
      let blocked = p.y < this.env.sample(p.x, p.z).height + 0.15;
      for (const o of blockers)
        if (
          Math.hypot(p.x - o.x, p.z - o.z) < o.radius + 0.15 &&
          p.y < this.env.sample(o.x, o.z).height + o.height
        )
          blocked = true;
      if (blocked) {
        desired.copy(target).lerp(p, Math.max(0.15, t - 0.12) / t);
        break;
      }
    }
    desired.y = Math.max(
      desired.y,
      this.env.sample(desired.x, desired.z).height + 0.15,
    );
    const alpha = this.initial ? 1 : 1 - Math.exp(-12 * dt);
    this.initial = false;
    this.camera.position.lerp(desired, alpha);
    this.target.lerp(target, alpha);
    this.camera.lookAt(this.target);
    this.camera.fov = underwater ? 61 : 55;
    this.camera.updateProjectionMatrix();
  }
  movement(x, z) {
    return {
      x: x * -Math.cos(this.yaw) + z * Math.sin(this.yaw),
      z: x * Math.sin(this.yaw) + z * Math.cos(this.yaw),
    };
  }
}
