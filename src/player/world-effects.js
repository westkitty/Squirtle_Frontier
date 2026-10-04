import { channelHeight, CHANNEL_DEPTH } from "../simulation/channel-terrain.js";
import * as THREE from "three";
import { fireSite, traceChannel } from "../simulation/frontier-systems.js";
import { heightAt } from "../worldgen.js";
import { WETLAND } from "./habitat-view.js";
export class WorldEffects {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.geo = new THREE.ConeGeometry(1, 1, 5);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xfca953 });
    this.fire = new THREE.InstancedMesh(this.geo, this.mat, 16);
    this.fire.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.fire);
    this.fire.frustumCulled = false;
    this.smokeMat = new THREE.MeshBasicMaterial({
      color: 0x3d4541,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });
    this.fireSmoke = new THREE.InstancedMesh(this.geo, this.smokeMat, 16);
    this.fireSmoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fireSmoke.frustumCulled = false;
    this.fireSmoke.count = 0;
    this.fireSmoke.visible = false;
    this.group.add(this.fireSmoke);
    this.rainMat = new THREE.MeshBasicMaterial({
      color: 0xb7dce0,
      transparent: true,
      opacity: 0.4,
    });
    this.rain = new THREE.InstancedMesh(this.geo, this.rainMat, 96);
    this.rain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rain.frustumCulled = false;
    this.group.add(this.rain);

    this.jetMat = new THREE.MeshBasicMaterial({
      color: 0x9ee7ff,
      transparent: true,
      opacity: 0.85,
    });
    this.jet = new THREE.InstancedMesh(this.geo, this.jetMat, 24);
    this.jet.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
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
    this.wake.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
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
    this.splash.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.splash.frustumCulled = false;
    this.splash.count = 0;
    this.splash.visible = false;
    this.group.add(this.splash);

    this.dustMat = new THREE.MeshBasicMaterial({
      color: 0xb9aa8a,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    this.slideDust = new THREE.InstancedMesh(this.geo, this.dustMat, 18);
    this.slideDust.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.slideDust.frustumCulled = false;
    this.slideDust.count = 0;
    this.slideDust.visible = false;
    this.group.add(this.slideDust);

    this.foamMat = new THREE.MeshBasicMaterial({
      color: 0xebf7fa,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    this.streamFoam = new THREE.InstancedMesh(this.geo, this.foamMat, 16);
    this.streamFoam.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.streamFoam.frustumCulled = false;
    this.streamFoam.count = 0;
    this.streamFoam.visible = false;
    this.group.add(this.streamFoam);

    this.mistMat = new THREE.MeshBasicMaterial({
      color: 0xb8ccc3,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    this.wetlandMist = new THREE.InstancedMesh(this.geo, this.mistMat, 14);
    this.wetlandMist.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wetlandMist.frustumCulled = false;
    this.wetlandMist.count = 0;
    this.wetlandMist.visible = false;
    this.group.add(this.wetlandMist);

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
    const effectScale = Math.max(
      0.2,
      Math.min(
        1,
        Number(options.effectScale ?? options.renderScale) || 1,
      ),
    );
    this.rain.count = Math.floor(
      state.frontier.weather.rain * 96 * effectScale,
    );
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
      const flicker =
          0.9 + Math.sin(state.elapsed * 13 + i * 2.17) * 0.1,
        lean = Math.sin(state.elapsed * 7.5 + i * 1.31) * 0.11;
      this.dummy.position.set(
        p.x + lean * 0.18,
        heightAt(p.x, p.z) + (h * flicker) / 2,
        p.z - lean * 0.12,
      );
      this.dummy.rotation.set(0, i * 0.73, lean);
      this.dummy.scale.set(
        0.42 + flicker * 0.08,
        h * 1.5 * flicker,
        0.42 + (1.8 - flicker) * 0.08,
      );
      this.dummy.updateMatrix();
      this.fire.setMatrixAt(count, this.dummy.matrix);
      this.dummy.position.y += h * 1.05 + 0.35;
      this.dummy.position.x += Math.sin(state.elapsed * 0.7 + i) * 0.12;
      this.dummy.position.z += Math.cos(state.elapsed * 0.6 + i) * 0.09;
      this.dummy.rotation.set(0, state.elapsed * 0.25 + i, lean * 0.25);
      const smokeScale = 0.22 + h * 0.2;
      this.dummy.scale.set(smokeScale, 0.3 + h * 0.55, smokeScale);
      this.dummy.updateMatrix();
      this.fireSmoke.setMatrixAt(count, this.dummy.matrix);
      count++;
    }
    this.fire.count = count;
    this.fire.visible = count > 0;
    this.fireSmoke.count =
      count > 0 ? Math.max(1, Math.round(count * effectScale)) : 0;
    this.fireSmoke.visible = this.fireSmoke.count > 0;
    this.rain.visible = this.rain.count > 0;
    this.channel.visible = state.frontier.stage > 0;
    this.fire.instanceMatrix.needsUpdate = true;
    this.fireSmoke.instanceMatrix.needsUpdate = true;
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
      this.jet.count = Math.max(8, Math.round(24 * effectScale));
      const snoutX = body.x + Math.sin(body.yaw) * 0.28,
        snoutY = body.y + 0.22,
        snoutZ = body.z + Math.cos(body.yaw) * 0.28,
        dirX = Math.sin(body.yaw),
        dirZ = Math.cos(body.yaw);
      for (let i = 0; i < this.jet.count; i++) {
        const dist = (i / Math.max(1, this.jet.count - 1)) * 2.8,
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
    if (inWater && speed > 0.25 && body.jetTime <= 0) {
      this.wake.visible = true;
      const wakeBase = Math.max(
        4,
        Math.min(16, Math.round(4 + Math.min(speed, 4) * 3)),
      );
      this.wake.count = Math.max(3, Math.round(wakeBase * effectScale));
      const surfY = water.level + 0.015,
        spread = 0.7 + Math.min(speed, 4) * 0.18;
      for (let i = 0; i < this.wake.count; i++) {
        const phase =
            (((state.elapsed * 1.5 + i * (1 / this.wake.count)) % 1) + 1) % 1,
          r = 0.18 + phase * spread,
          trailDist = phase * Math.min(speed, 4.0) * 0.42,
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
      const strength = isShaking
        ? 1
        : Math.max(0.3, Math.min(1, body.impact / 0.2));
      const splashBase = Math.max(6, Math.round(20 * strength));
      this.splash.count = Math.max(4, Math.round(splashBase * effectScale));
      for (let i = 0; i < this.splash.count; i++) {
        const theta =
            (i / this.splash.count) * Math.PI * 2 + state.elapsed * 12,
          arcDist =
            0.25 +
            ((((i * 0.31 + state.elapsed * 4) % 1) + 1) % 1) *
              (0.55 + strength * 0.65),
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

    // 4. Dry shell-slide dust: body-specific contact feedback, never emitted in water.
    const drySlide = !inWater && body.mode === "slide" && speed > 0.8;
    if (drySlide) {
      this.slideDust.visible = true;
      const dustBase = Math.min(18, Math.max(4, Math.round(speed * 3.2)));
      this.slideDust.count = Math.max(3, Math.round(dustBase * effectScale));
      const dirX = speed > 0.01 ? body.vx / speed : Math.sin(body.yaw),
        dirZ = speed > 0.01 ? body.vz / speed : Math.cos(body.yaw);
      for (let i = 0; i < this.slideDust.count; i++) {
        const phase =
            (((state.elapsed * 2.1 + i / this.slideDust.count) % 1) + 1) % 1,
          side = Math.sin(i * 5.31) * 0.22 * phase,
          behind = 0.18 + phase * 1.15;
        this.dummy.position.set(
          body.x - dirX * behind - dirZ * side,
          heightAt(body.x - dirX * behind, body.z - dirZ * behind) +
            0.03 +
            phase * 0.18,
          body.z - dirZ * behind + dirX * side,
        );
        const size = 0.06 + phase * 0.1;
        this.dummy.rotation.set(0, i * 1.7, 0);
        this.dummy.scale.set(size * 1.5, size * 0.55, size * 1.5);
        this.dummy.updateMatrix();
        this.slideDust.setMatrixAt(i, this.dummy.matrix);
      }
      this.slideDust.instanceMatrix.needsUpdate = true;
    } else {
      this.slideDust.count = 0;
      this.slideDust.visible = false;
    }

    // 5. Saturated wetland mist. It reuses the shared low-poly effect geometry,
    // so atmosphere polish does not widen the renderer's geometry budget.
    const wetlandWetness = THREE.MathUtils.clamp(
        Number(state.watershed?.nodes?.[2]?.wetness) || 0,
        0,
        1,
      ),
      wetlandDistance = Math.hypot(body.x - WETLAND.x, body.z - WETLAND.z),
      mistStrength =
        wetlandDistance < 30 && wetlandWetness > 0.52
          ? (wetlandWetness - 0.52) / 0.48
          : 0,
      mistBase = Math.round(14 * mistStrength * effectScale);
    this.wetlandMist.count = mistBase;
    this.wetlandMist.visible = mistBase > 0;
    this.mistMat.opacity =
      0.06 +
      mistStrength * 0.1 * (1 - state.frontier.weather.rain * 0.45);
    for (let i = 0; i < this.wetlandMist.count; i++) {
      const angle = i * 2.39996 + state.elapsed * 0.025,
        radius = 1.4 + (i % 5) * 0.92,
        drift = Math.sin(state.elapsed * 0.22 + i * 1.71) * 0.28,
        x = WETLAND.x + Math.cos(angle) * (radius + drift),
        z = WETLAND.z + Math.sin(angle) * (radius + drift),
        y = heightAt(x, z) + 0.16 + (i % 4) * 0.07;
      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(Math.PI / 2, angle, 0);
      this.dummy.scale.set(
        0.7 + (i % 3) * 0.35,
        0.08 + (i % 2) * 0.03,
        0.45 + ((i + 1) % 3) * 0.27,
      );
      this.dummy.updateMatrix();
      this.wetlandMist.setMatrixAt(i, this.dummy.matrix);
    }
    this.wetlandMist.instanceMatrix.needsUpdate = true;

    // 6. Stream foam rapids: churning white water along active flowing channel
    if (state.frontier.stage >= 2 && this.route.length > 1) {
      const channelFlow = Math.max(
        0,
        Math.min(1, Number(options.channelFlow ?? 1)),
      );
      const foamBase =
        channelFlow > 0.04 ? Math.max(4, Math.round(16 * channelFlow)) : 0;
      this.streamFoam.count =
        foamBase > 0 ? Math.max(3, Math.round(foamBase * effectScale)) : 0;
      this.streamFoam.visible = this.streamFoam.count > 0;
      for (let i = 0; i < this.streamFoam.count; i++) {
        const progress =
          (((i / this.streamFoam.count + state.elapsed * 0.35) % 1) + 1) % 1;
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
      smoke: this.fireSmoke.count,
      dust: this.slideDust.count,
      mist: this.wetlandMist.count,
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
    this.slideDust.dispose();
    this.dustMat.dispose();
    this.fireSmoke.dispose();
    this.smokeMat.dispose();
    this.streamFoam.dispose();
    this.foamMat.dispose();
    this.wetlandMist.dispose();
    this.mistMat.dispose();

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
