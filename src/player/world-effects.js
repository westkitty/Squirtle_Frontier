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
  update(state, body) {
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
  }

  dispose() {
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
