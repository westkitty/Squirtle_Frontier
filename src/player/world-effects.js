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
    this.channelGeo = new THREE.PlaneGeometry(1, 1);
    this.channelMat = new THREE.MeshStandardMaterial({
      color: 0x4a7e70,
      roughness: 0.7,
    });
    this.channel = new THREE.InstancedMesh(
      this.channelGeo,
      this.channelMat,
      this.route.length - 1,
    );
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
    this.channel.count = this.route.length - 1;
    this.channelMat.color.set(state.frontier.stage < 2 ? 0x71664a : 0x428d85);
    for (let i = 0; i < this.channel.count; i++) {
      const a = this.route[i],
        b = this.route[i + 1];
      this.dummy.position.set(
        (a.x + b.x) / 2,
        (a.y + b.y) / 2 + 0.025,
        (a.z + b.z) / 2,
      );
      this.dummy.rotation.set(
        -Math.PI / 2,
        0,
        -Math.atan2(b.x - a.x, b.z - a.z),
      );
      this.dummy.scale.set(0.13 + state.frontier.stage * 0.08, 0.66, 1);
      this.dummy.updateMatrix();
      this.channel.setMatrixAt(i, this.dummy.matrix);
    }
    this.channel.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    this.rain.dispose();
    this.rainMat.dispose();
    this.fire.dispose();
    this.channel.dispose();
    this.geo.dispose();
    this.mat.dispose();
    this.channelGeo.dispose();
    this.channelMat.dispose();
    this.group.removeFromParent();
  }
}
