import * as THREE from "three";
import { heightAt } from "../worldgen.js";
export const LAB_ENTRY = Object.freeze({ x: -11, z: 5 });
export const SETTLEMENT = Object.freeze({ x: -15, z: -12 });
export const WETLAND = Object.freeze({ x: -6, z: -15 });
export const labHeight = (x, z) => {
  const d = Math.hypot(x, z);
  return d < 2.5 ? -1.4 : d < 3.4 ? -1.4 + ((d - 2.5) / 0.9) * 1.4 : 0;
};
export const labRegion = {
  sample: (x, z) => ({
    height: labHeight(x, z),
    dx: (labHeight(x + 0.1, z) - labHeight(x - 0.1, z)) / 0.2,
    dz: (labHeight(x, z + 0.1) - labHeight(x, z - 0.1)) / 0.2,
  }),
  water: (x, z) =>
    Math.hypot(x, z) < 3.15 ? { level: -0.2, currentX: 0, currentZ: 0 } : null,
  // Conservative circular proxies for walls and furnishings; shared by body and boom.
  obstacles: [
    ...Array.from({ length: 17 }, (_, i) => ({
      x: -8,
      z: i - 8,
      radius: 0.5,
      height: 4,
    })),
    ...Array.from({ length: 17 }, (_, i) => ({
      x: 8,
      z: i - 8,
      radius: 0.5,
      height: 4,
    })),
    ...Array.from({ length: 15 }, (_, i) => ({
      x: i - 7,
      z: -8,
      radius: 0.5,
      height: 4,
    })),
    { x: -4.4, z: 4, radius: 1.3, height: 0.7 },
    { x: 4, z: 4, radius: 1.2, height: 1.3 },
  ],
};
// Small locally-owned procedural fixtures, not individual distant populations.
export class HabitatView {
  constructor(parent, { lab = false } = {}) {
    this.lab = lab;
    this.group = new THREE.Group();
    parent.add(this.group);
    this.resources = [];
    this.instances = [];
    this.box = this.own(new THREE.BoxGeometry(1, 1, 1));
    this.cylinder = this.own(new THREE.CylinderGeometry(1, 1, 1, 12));
    this.sphere = this.own(new THREE.SphereGeometry(1, 6, 4));
    this.stone = this.own(
      new THREE.MeshStandardMaterial({ color: 0x82968e, roughness: 1 }),
    );
    this.wood = this.own(
      new THREE.MeshStandardMaterial({ color: 0x776047, roughness: 1 }),
    );
    this.green = this.own(
      new THREE.MeshStandardMaterial({ color: 0x547f40, roughness: 1 }),
    );
    this.waterMat = this.own(
      new THREE.MeshStandardMaterial({
        color: 0x559d94,
        transparent: true,
        opacity: 0.65,
        roughness: 0.4,
      }),
    );
    this.animalMat = this.own(
      new THREE.MeshStandardMaterial({ color: 0x768e46, roughness: 1 }),
    );
    this.dummy = new THREE.Object3D();
    if (lab) this.buildLab();
    else this.buildFrontier();
  }
  own(resource) {
    this.resources.push(resource);
    return resource;
  }
  mesh(
    geometry,
    material,
    x,
    y,
    z,
    sx = 1,
    sy = 1,
    sz = 1,
    parent = this.group,
  ) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    parent.add(m);
    return m;
  }
  pool(geometry, material, capacity, parent = this.group) {
    const m = new THREE.InstancedMesh(geometry, material, capacity);
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    parent.add(m);
    this.instances.push(m);
    return m;
  }
  buildFrontier() {
    this.entry = new THREE.Group();
    this.group.add(this.entry);
    const { x, z } = LAB_ENTRY,
      y = heightAt(x, z);
    this.mesh(
      this.box,
      this.stone,
      x - 0.9,
      y + 0.8,
      z,
      0.35,
      1.6,
      0.7,
      this.entry,
    );
    this.mesh(
      this.box,
      this.stone,
      x + 0.9,
      y + 0.8,
      z,
      0.35,
      1.6,
      0.7,
      this.entry,
    );
    this.mesh(this.box, this.stone, x, y + 1.7, z, 2.2, 0.35, 0.7, this.entry);
    this.settlement = new THREE.Group();
    this.group.add(this.settlement);
    const a = SETTLEMENT,
      h = heightAt(a.x, a.z);
    this.mesh(
      this.box,
      this.wood,
      a.x,
      h + 1.8,
      a.z,
      3,
      3.6,
      3,
      this.settlement,
    );
    this.mesh(
      this.box,
      this.stone,
      a.x,
      h + 3.7,
      a.z,
      3.7,
      0.35,
      3.7,
      this.settlement,
    );
    this.mesh(
      this.box,
      this.stone,
      a.x + 2.4,
      h + 0.5,
      a.z,
      1.3,
      1,
      2,
      this.settlement,
    );
    this.trough = this.mesh(
      this.box,
      this.waterMat,
      a.x + 2.4,
      h + 1.02,
      a.z,
      1.1,
      0.04,
      1.8,
      this.settlement,
    );
    this.wetland = new THREE.Group();
    this.group.add(this.wetland);
    this.reeds = this.pool(this.cylinder, this.green, 48, this.wetland);
    this.animals = this.pool(this.sphere, this.animalMat, 12, this.wetland);
    this.preyHeads = this.pool(this.sphere, this.animalMat, 12, this.wetland);
    this.preyLegs = this.pool(this.sphere, this.animalMat, 24, this.wetland);
    this.predatorMat = this.own(
      new THREE.MeshStandardMaterial({ color: 0x66513e, roughness: 1 }),
    );
    this.predators = this.pool(this.sphere, this.predatorMat, 3, this.wetland);
    this.predatorHeads = this.pool(
      this.sphere,
      this.predatorMat,
      3,
      this.wetland,
    );
    this.predatorLegs = this.pool(this.box, this.predatorMat, 12, this.wetland);
    this.caretaker = new THREE.Group();
    this.settlement.add(this.caretaker);
    this.mesh(
      this.cylinder,
      this.wood,
      0,
      0.85,
      0,
      0.19,
      0.85,
      0.19,
      this.caretaker,
    );
    this.mesh(
      this.sphere,
      this.stone,
      0,
      1.48,
      0,
      0.17,
      0.2,
      0.17,
      this.caretaker,
    );
    for (const x of [-0.1, 0.1])
      this.mesh(
        this.box,
        this.wood,
        x,
        0.28,
        0,
        0.12,
        0.55,
        0.14,
        this.caretaker,
      );
    this.arm = this.mesh(
      this.box,
      this.wood,
      0.28,
      0.95,
      0,
      0.12,
      0.65,
      0.12,
      this.caretaker,
    );
    this.caretaker.position.set(a.x + 2.4, h, a.z + 2);
    this.door = this.mesh(
      this.box,
      this.wood,
      a.x,
      h + 1,
      a.z + 1.53,
      1,
      2,
      0.1,
      this.settlement,
    );
    this.bowl = this.mesh(
      this.cylinder,
      this.stone,
      a.x + 2.4,
      h + 0.09,
      a.z + 2,
      0.38,
      0.18,
      0.38,
      this.settlement,
    );
    this.bowlWater = this.mesh(
      this.cylinder,
      this.waterMat,
      a.x + 2.4,
      h + 0.19,
      a.z + 2,
      0.32,
      0.02,
      0.32,
      this.settlement,
    );
  }
  buildLab() {
    // Basin floor is sampled from exactly the same authored shape as body contact.
    const floor = this.own(new THREE.PlaneGeometry(16, 16, 48, 48));
    floor.rotateX(-Math.PI / 2);
    const p = floor.attributes.position;
    for (let i = 0; i < p.count; i++)
      p.setY(i, labHeight(p.getX(i), p.getZ(i)));
    floor.computeVertexNormals();
    this.mesh(floor, this.stone, 0, 0, 0);
    for (const [x, z, sx, sz] of [
      [-8, 0, 0.3, 16],
      [8, 0, 0.3, 16],
      [0, -8, 16, 0.3],
    ])
      this.mesh(this.box, this.stone, x, 2, z, sx, 4, sz);
    this.mesh(this.box, this.stone, -4.4, 0.3, 4, 2.5, 0.6, 2);
    this.mesh(this.box, this.wood, -4.4, 0.64, 4, 2, 0.12, 1.5); // resting platform
    this.mesh(this.box, this.stone, 4, 1.1, 4, 2.2, 0.25, 1.2);
    this.mesh(this.sphere, this.wood, 4, 1.5, 4, 0.26, 0.26, 0.26);
    this.mesh(this.box, this.wood, 0, 0.04, 6, 1.8, 0.08, 1); // exit threshold
    this.basin = this.mesh(
      this.cylinder,
      this.waterMat,
      0,
      -0.2,
      0,
      3.15,
      0.015,
      3.15,
    );
    this.reeds = this.pool(this.cylinder, this.green, 48);
    this.animals = this.pool(this.sphere, this.animalMat, 12);
    this.visitor = new THREE.Group();
    this.group.add(this.visitor);
    this.visitorMat = this.own(
      new THREE.MeshStandardMaterial({ color: 0xc3b465, roughness: 1 }),
    );
    this.mesh(
      this.sphere,
      this.visitorMat,
      0,
      0.12,
      0,
      0.18,
      0.12,
      0.24,
      this.visitor,
    );
    this.mesh(
      this.sphere,
      this.visitorMat,
      0,
      0.18,
      0.17,
      0.16,
      0.1,
      0.13,
      this.visitor,
    );
    for (const x of [-0.15, 0.15])
      this.mesh(
        this.sphere,
        this.visitorMat,
        x,
        0.045,
        -0.1,
        0.1,
        0.045,
        0.16,
        this.visitor,
      );
    this.visitor.position.set(0, 0, 3.6);
  }
  update(
    ecosystem,
    body,
    time,
    notable = null,
    wildlife = null,
    settlement = null,
    dt = 1 / 60,
  ) {
    if (this.visitor) {
      this.visitor.visible = !!notable;
      if (notable) {
        const desired =
          notable.fear > 0.25 ? 4.5 : notable.familiarity > 0.3 ? 3.5 : 4;
        const angle = Math.atan2(body.x, body.z);
        this.visitor.position.set(
          Math.sin(angle) * desired,
          0,
          Math.cos(angle) * desired,
        );
        this.visitor.rotation.y = angle + Math.PI;
        this.visitorMat.color.setHSL(0.12 + notable.marking * 0.015, 0.4, 0.55);
      }
    }
    const amount = this.lab ? ecosystem.labReeds : ecosystem.reeds;
    const life = this.lab ? ecosystem.labFrogs : ecosystem.prey;
    const center = this.lab ? { x: 0, z: 0 } : WETLAND;
    const nearby =
      this.lab || Math.hypot(body.x - center.x, body.z - center.z) < 28;
    if (!this.lab) {
      this.entry.visible =
        Math.hypot(body.x - LAB_ENTRY.x, body.z - LAB_ENTRY.z) < 32;
      this.settlement.visible =
        Math.hypot(body.x - SETTLEMENT.x, body.z - SETTLEMENT.z) < 32;
      this.wetland.visible = nearby;
      if (settlement) {
        const mode = settlement.response,
          h = heightAt(SETTLEMENT.x, SETTLEMENT.z);
        const target =
          mode === "withdraw"
            ? { x: SETTLEMENT.x, z: SETTLEMENT.z + 1.8 }
            : mode === "check-water"
              ? { x: SETTLEMENT.x + 2.4, z: SETTLEMENT.z + 1.2 }
              : { x: SETTLEMENT.x + 2.8, z: SETTLEMENT.z + 2.4 };
        const a = 1 - Math.exp(-dt * 1.5);
        this.caretaker.position.x += (target.x - this.caretaker.position.x) * a;
        this.caretaker.position.z += (target.z - this.caretaker.position.z) * a;
        this.caretaker.position.y = h;
        this.caretaker.rotation.y = Math.atan2(
          body.x - this.caretaker.position.x,
          body.z - this.caretaker.position.z,
        );
        this.arm.rotation.z =
          mode === "welcome" ? -0.9 : mode === "withdraw" ? 0.5 : 0;
        this.door.visible = mode === "withdraw";
        this.bowl.visible = settlement.familiarity >= 0.25;
        this.bowlWater.visible = this.bowl.visible && settlement.bowl > 0.02;
        this.bowlWater.position.y = h + 0.1 + settlement.bowl * 0.09;
      }
      this.trough.visible = ecosystem.cistern > 0.03;
      this.trough.position.y =
        heightAt(SETTLEMENT.x, SETTLEMENT.z) + 0.2 + ecosystem.cistern * 0.83;
    } else {
      this.basin.material.opacity = 0.25 + ecosystem.labWater * 0.45;
    }
    this.reeds.count = nearby ? Math.floor(amount * 48) : 0;
    for (let i = 0; i < this.reeds.count; i++) {
      const angle = i * 2.39996,
        radius = this.lab ? 2.8 + (i % 4) * 0.08 : 1 + (i % 8) * 0.28;
      const x = center.x + Math.cos(angle) * radius,
        z = center.z + Math.sin(angle) * radius;
      const h = 0.25 + (i % 5) * 0.12,
        y = this.lab ? labHeight(x, z) : heightAt(x, z);
      this.dummy.position.set(x, y + h / 2, z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(0.025, h, 0.025);
      this.dummy.updateMatrix();
      this.reeds.setMatrixAt(i, this.dummy.matrix);
    }
    if (!this.lab) {
      const agents = wildlife?.actors || [];
      const prey = agents.filter((a) => a.kind === "prey"),
        predators = agents.filter((a) => a.kind === "predator");
      this.animals.count = prey.length;
      this.preyHeads.count = prey.length;
      this.preyLegs.count = prey.length * 2;
      this.predators.count = predators.length;
      this.predatorHeads.count = predators.length;
      this.predatorLegs.count = predators.length * 4;
      const part = (pool, index, a, ox, oy, oz, sx, sy, sz) => {
        const x = a.x + Math.cos(a.yaw) * ox + Math.sin(a.yaw) * oz,
          z = a.z - Math.sin(a.yaw) * ox + Math.cos(a.yaw) * oz;
        this.dummy.position.set(x, heightAt(a.x, a.z) + oy, z);
        this.dummy.rotation.set(0, a.yaw, 0);
        this.dummy.scale.set(sx, sy, sz);
        this.dummy.updateMatrix();
        pool.setMatrixAt(index, this.dummy.matrix);
      };
      prey.forEach((a, i) => {
        const hop =
          a.mode === "forage"
            ? 0
            : Math.abs(Math.sin(time * 12 + a.phase)) * 0.08;
        part(this.animals, i, a, 0, 0.1 + hop, 0, 0.16, 0.1, 0.23);
        part(this.preyHeads, i, a, 0, 0.18 + hop, 0.17, 0.14, 0.09, 0.12);
        for (let j = 0; j < 2; j++)
          part(
            this.preyLegs,
            i * 2 + j,
            a,
            j ? 0.15 : -0.15,
            0.05 + hop,
            -0.12,
            0.1,
            0.04,
            0.17,
          );
      });
      predators.forEach((a, i) => {
        part(this.predators, i, a, 0, 0.38, 0, 0.23, 0.2, 0.48);
        part(this.predatorHeads, i, a, 0, 0.48, 0.4, 0.17, 0.15, 0.22);
        for (let j = 0; j < 4; j++)
          part(
            this.predatorLegs,
            i * 4 + j,
            a,
            j % 2 ? 0.16 : -0.16,
            0.15 + (a.mode === "stalk" ? Math.sin(time * 9 + j) * 0.025 : 0),
            j < 2 ? 0.27 : -0.27,
            0.065,
            0.3,
            0.07,
          );
      });
      for (const mesh of [
        this.animals,
        this.preyHeads,
        this.preyLegs,
        this.predators,
        this.predatorHeads,
        this.predatorLegs,
      ])
        mesh.instanceMatrix.needsUpdate = true;
    } else {
      this.animals.count = nearby ? Math.floor(life * 12) : 0;
      for (let i = 0; i < this.animals.count; i++) {
        const t = time * 0.12 + i * 2.4,
          r = 3.5;
        const x = center.x + Math.cos(t) * r,
          z = center.z + Math.sin(t) * r;
        this.dummy.position.set(x, labHeight(x, z) + 0.08, z);
        this.dummy.rotation.set(0, t, 0);
        this.dummy.scale.set(0.14, 0.08, 0.2);
        this.dummy.updateMatrix();
        this.animals.setMatrixAt(i, this.dummy.matrix);
      }
    }
    this.reeds.instanceMatrix.needsUpdate = true;
    this.animals.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    for (const m of this.instances) m.dispose();
    for (const r of this.resources) r.dispose();
    this.group.removeFromParent();
  }
}
