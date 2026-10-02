import { channelHeight, CHANNEL_DEPTH } from "../simulation/channel-terrain.js";
import * as THREE from "three";
import { fireSite, traceChannel } from "../simulation/frontier-systems.js";
import { heightAt } from "../worldgen.js";
export class WorldEffects {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.geo = new THREE.ConeGeometry(1, 1, 5);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xfca953 });
    this.fire = new THREE.InstancedMesh(this.geo, this.mat, 16);
    this.group.add(this.fire);
    this.fire.frustumCulled = false;
    this.rainMat = new THREE.MeshBasicMaterial({
      color: 0xb7dce0,
      transparent: true,
      opacity: 0.4,
    });
    this.rain = new THREE.InstancedMesh(this.geo, this.rainMat, 96);
    this.rain.frustumCulled = false;
    this.group.add(this.rain);

    this.jetMat = new THREE.MeshBasicMaterial({
      color: 0x9ee7ff,
      transparent: true,
      opacity: 0.85,
    });
    this.jet = new THREE.InstancedMesh(this.geo, this.jetMat, 24);
    this.jet.frustumCulled = false;
    this.jet.count = 0;
    this.jet.visible = false;
    this.group.add(this.jet);

    this.wakeMat = new THREE.MeshBasicMaterial({
      color: 0x90e6f7,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });
    this.wake = new THREE.InstancedMesh(this.geo, this.wakeMat, 16);
    this.wake.frustumCulled = false;
    this.wake.count = 0;
    this.wake.visible = false;
    this.group.add(this.wake);

    this.splashMat = new THREE.MeshBasicMaterial({
      color: 0xc6f3ff,
      transparent: true,
      opacity: 0.75,
    });
    this.splash = new THREE.InstancedMesh(this.geo, this.splashMat, 20);
    this.splash.frustumCulled = false;
    this.splash.count = 0;
    this.splash.visible = false;
    this.group.add(this.splash);

    this.foamMat = new THREE.MeshBasicMaterial({
      color: 0xebf7fa,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    this.streamFoam = new THREE.InstancedMesh(this.geo, this.foamMat, 16);
    this.streamFoam.frustumCulled = false;
    this.streamFoam.count = 0;
    this.streamFoam.visible = false;
    this.group.add(this.streamFoam);

    this.route = traceChannel();
    this.channelGeo = new THREE.BufferGeometry();
    this.channelGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array((this.route.length - 1) * 18),
        3,
      ),
    );
    this.channelMat = new THREE.MeshStandardMaterial({
      color: 0x4a7e70,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });
    this.channel = new THREE.Mesh(this.channelGeo, this.channelMat);
    this.group.add(this.channel);
    this.channel.frustumCulled = false;
    this.dummy = new THREE.Object3D();
  }
  update(state, body, options = {}) {
    this.rain.count = Math.floor(state.frontier.weather.rain * 96);
    for (let i = 0; i < this.rain.count; i++) {
      const x = body.x + Math.sin(i * 3.3) * 8,
        z = body.z + Math.cos(i * 5.7) * 8;
      this.dummy.position.set(
        x,
        heightAt(x, z) + ((((i * 0.37 - state.elapsed * 5) % 5) + 5) % 5),
        z,
      );
      this.dummy.rotation.set(0, 0, -0.18);
      this.dummy.scale.set(0.008, 0.3, 0.008);
      this.dummy.updateMatrix();
      this.rain.setMatrixAt(i, this.dummy.matrix);
    }
    this.rain.instanceMatrix.needsUpdate = true;
    let count = 0;
    for (let i = 0; i < 16; i++) {
      const p = fireSite(i),
        h = state.frontier.heat[i];
      if (h < 0.02 || Math.hypot(body.x - p.x, body.z - p.z) > 35) continue;
      this.dummy.position.set(p.x, heightAt(p.x, p.z) + h / 2, p.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(0.5, h * 1.5, 0.5);
      this.dummy.updateMatrix();
      this.fire.setMatrixAt(count++, this.dummy.matrix);
    }
    this.fire.count = count;
    this.fire.visible = count > 0;
    this.rain.visible = this.rain.count > 0;
    this.channel.visible = state.frontier.stage > 0;
    this.fire.instanceMatrix.needsUpdate = true;
    this.channelMat.color.set(state.frontier.stage < 2 ? 0x71664a : 0x428d85);
    if (this.channelStage !== state.frontier.stage) {
      this.channelStage = state.frontier.stage;
      const positions = this.channelGeo.attributes.position;
      let index = 0;
      for (let i = 0; i < this.route.length - 1; i++) {
        const a = this.route[i],
          b = this.route[i + 1],
          dx = b.x - a.x,
          dz = b.z - a.z,
          len = Math.hypot(dx, dz);
        const w = 0.045 + state.frontier.stage * 0.022;
        const point = (p, sign) => [
          p.x + ((sign * dz) / len) * w,
          channelHeight(p.x, p.z, state.frontier.stage) +
            CHANNEL_DEPTH[state.frontier.stage] * 0.55 +
            0.015,
          p.z - ((sign * dx) / len) * w,
        ];
        const al = point(a, -1),
          ar = point(a, 1),
          bl = point(b, -1),
          br = point(b, 1);
        for (const v of [al, bl, ar, ar, bl, br])
          positions.setXYZ(index++, ...v);
      }
      positions.needsUpdate = true;
      this.channelGeo.computeVertexNormals();
      this.channelGeo.computeBoundingSphere();
    }

    // 1. Water Jet stream: pressurized aquatic propulsion forward from snout
    if (body.jetTime > 0) {
      this.jet.visible = true;
      this.jet.count = 24;
      const snoutX = body.x + Math.sin(body.yaw) * 0.28,
        snoutY = body.y + 0.22,
        snoutZ = body.z + Math.cos(body.yaw) * 0.28,
        dirX = Math.sin(body.yaw),
        dirZ = Math.cos(body.yaw);
      for (let i = 0; i < 24; i++) {
        const dist = (i / 23) * 2.8,
          spread = dist * 0.1,
          turbX = Math.sin(i * 3.7 + state.elapsed * 25) * spread,
          turbZ = Math.cos(i * 2.9 + state.elapsed * 25) * spread,
          turbY = (Math.sin(i * 5.1 + state.elapsed * 30) - 0.2) * spread * 0.5;
        this.dummy.position.set(
          snoutX + dirX * dist + turbX,
          snoutY + turbY,
          snoutZ + dirZ * dist + turbZ,
        );
        this.dummy.rotation.set(0, body.yaw, 0);
        this.dummy.scale.set(
          0.035 * (1 + dist * 0.35),
          0.12 * (1 + dist * 0.6),
          0.035 * (1 + dist * 0.35),
        );
        this.dummy.updateMatrix();
        this.jet.setMatrixAt(i, this.dummy.matrix);
      }
      this.jet.instanceMatrix.needsUpdate = true;
    } else {
      this.jet.count = 0;
      this.jet.visible = false;
    }

    // 2. Aquatic surface wake: expanding concentric ripples during swimming/sliding in water
    const water = options?.water;
    const inWater = !!water && body.y <= water.level + 0.15;
    const speed = Math.hypot(body.vx, body.vz);
    if (inWater && (speed > 0.25 || body.mode === "swim" || body.mode === "dive")) {
      this.wake.visible = true;
      this.wake.count = 16;
      const surfY = water.level + 0.015;
      for (let i = 0; i < 16; i++) {
        const phase = (((state.elapsed * 1.5 + i * (1 / 16)) % 1) + 1) % 1,
          r = 0.25 + phase * 1.4,
          trailDist = phase * Math.min(speed, 4.0) * 0.35,
          rx = body.x - (speed > 0.01 ? (body.vx / speed) * trailDist : 0),
          rz = body.z - (speed > 0.01 ? (body.vz / speed) * trailDist : 0);
        this.dummy.position.set(rx, surfY, rz);
        this.dummy.rotation.set(-Math.PI / 2, 0, 0);
        this.dummy.scale.set(r, 0.008, r);
        this.dummy.updateMatrix();
        this.wake.setMatrixAt(i, this.dummy.matrix);
      }
      this.wake.instanceMatrix.needsUpdate = true;
    } else {
      this.wake.count = 0;
      this.wake.visible = false;
    }

    // 3. Splash / water-exit shake droplets: radial scatter during shake or water impact
    const isShaking = options?.isShaking ?? false;
    const splashActive = isShaking || (inWater && body.impact > 0.06);
    if (splashActive) {
      this.splash.visible = true;
      this.splash.count = 20;
      for (let i = 0; i < 20; i++) {
        const theta = (i / 20) * Math.PI * 2 + state.elapsed * 12,
          arcDist = 0.35 + ((((i * 0.31 + state.elapsed * 4) % 1) + 1) % 1) * 1.1,
          dropletY = body.y + 0.2 + Math.sin(arcDist * Math.PI) * 0.35;
        this.dummy.position.set(
          body.x + Math.cos(theta) * arcDist,
          dropletY,
          body.z + Math.sin(theta) * arcDist,
        );
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.set(0.025, 0.06, 0.025);
        this.dummy.updateMatrix();
        this.splash.setMatrixAt(i, this.dummy.matrix);
      }
      this.splash.instanceMatrix.needsUpdate = true;
    } else {
      this.splash.count = 0;
      this.splash.visible = false;
    }

    // 4. Stream foam rapids: churning white water along active flowing channel
    if (state.frontier.stage >= 2 && this.route.length > 1) {
      this.streamFoam.visible = true;
      this.streamFoam.count = 16;
      for (let i = 0; i < 16; i++) {
        const progress = (((i / 16 + state.elapsed * 0.35) % 1) + 1) % 1;
        const floatIdx = progress * (this.route.length - 1);
        const idx = Math.floor(floatIdx);
        const fract = floatIdx - idx;
        const p0 = this.route[idx];
        const p1 = this.route[Math.min(idx + 1, this.route.length - 1)];
        const wobble = Math.sin(state.elapsed * 5.5 + i * 2.1) * 0.035;
        const dx = p1.x - p0.x,
          dz = p1.z - p0.z;
        const len = Math.hypot(dx, dz) || 1;
        const px = p0.x + dx * fract + (-dz / len) * wobble;
        const pz = p0.z + dz * fract + (dx / len) * wobble;
        const py =
          channelHeight(px, pz, state.frontier.stage) +
          CHANNEL_DEPTH[state.frontier.stage] * 0.55 +
          0.022;
        const s = 0.032 + Math.sin(i * 3.7 + state.elapsed * 4) * 0.01;
        this.dummy.position.set(px, py, pz);
        this.dummy.scale.set(s * 1.6, s * 0.5, s * 1.6);
        this.dummy.rotation.set(0, state.elapsed * 2.8 + i, 0);
        this.dummy.updateMatrix();
        this.streamFoam.setMatrixAt(i, this.dummy.matrix);
      }
      this.streamFoam.instanceMatrix.needsUpdate = true;
    } else {
      this.streamFoam.count = 0;
      this.streamFoam.visible = false;
    }
  }

  stats() {
    return {
      rain: this.rain.count,
      fire: this.fire.count,
      jet: this.jet.count,
      wake: this.wake.count,
      splash: this.splash.count,
      foam: this.streamFoam.count,
    };
  }

  dispose() {
    this.jet.dispose();
    this.jetMat.dispose();
    this.wake.dispose();
    this.wakeMat.dispose();
    this.splash.dispose();
    this.splashMat.dispose();
    this.streamFoam.dispose();
    this.foamMat.dispose();

    this.rain.dispose();
    this.rainMat.dispose();
    this.fire.dispose();

    this.geo.dispose();
    this.mat.dispose();
    this.channelGeo.dispose();
    this.channelMat.dispose();
    this.group.removeFromParent();
  }
}
