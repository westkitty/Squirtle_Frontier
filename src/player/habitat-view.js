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
      new THREE.MeshStandardMaterial({ color: 0x82968e, roughness: 0.96 }),
    );
    this.stone.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "varying vec3 vStoneWPos;\nvarying vec3 vStoneNorm;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vStoneWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vStoneNorm = normalize(mat3(modelMatrix) * normal);`,
        );
      shader.fragmentShader =
        "varying vec3 vStoneWPos;\nvarying vec3 vStoneNorm;\n" +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float grain = (sin(vStoneWPos.x * 12.0) * cos(vStoneWPos.z * 12.0) + sin(vStoneWPos.y * 14.0)) * 0.03;
          float chiseled = sin(vStoneWPos.x * 24.0) * cos(vStoneWPos.z * 24.0) * 0.025;
          diffuseColor.rgb += vec3(grain * 0.8 + chiseled, grain + chiseled * 1.1, grain * 0.9 + chiseled * 0.8);
          float mossCrevice = smoothstep(0.4, -0.2, vStoneWPos.y) * 0.35;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.35, 0.44, 0.34), mossCrevice);
          float lichen = step(0.78, sin(vStoneWPos.x * 32.0 + vStoneWPos.z * 24.0) * sin(vStoneWPos.y * 28.0)) * 0.18;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.58, 0.38), lichen);`,
        );
    };
    this.stone.customProgramCacheKey = () => "frontier-stone-patina-v2";

    this.wood = this.own(
      new THREE.MeshStandardMaterial({ color: 0x776047, roughness: 0.92 }),
    );
    this.wood.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "varying vec3 vWoodPos;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vWoodPos = position;`,
        );
      shader.fragmentShader =
        "varying vec3 vWoodPos;\n" +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float grain = sin(vWoodPos.y * 42.0 + sin(vWoodPos.x * 20.0) * 2.0) * 0.045;
          float planks = sin(vWoodPos.z * 16.0) * 0.025;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.15, 1.1, 0.95), grain + planks);
          float weather = smoothstep(0.3, -0.4, vWoodPos.y) * 0.12;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.38, 0.32, 0.26), weather);`,
        );
    };
    this.wood.customProgramCacheKey = () => "frontier-wood-timber-v2";

    this.green = this.own(
      new THREE.MeshStandardMaterial({ color: 0x547f40, roughness: 0.95 }),
    );
    this.green.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "varying vec3 vReedPos;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vReedPos = position;`,
        );
      shader.fragmentShader =
        "varying vec3 vReedPos;\n" +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float h = clamp(vReedPos.y + 0.5, 0.0, 1.0);
          vec3 stalkBase = vec3(0.44, 0.54, 0.26);
          vec3 reedGreen = vec3(0.28, 0.46, 0.22);
          vec3 cattailHead = vec3(0.36, 0.24, 0.14);
          vec3 reedCol = mix(stalkBase, reedGreen, smoothstep(0.0, 0.45, h));
          reedCol = mix(reedCol, cattailHead, smoothstep(0.72, 0.92, h));
          diffuseColor.rgb = reedCol;`,
        );
    };
    this.green.customProgramCacheKey = () => "frontier-reed-cattail-v1";
    this.waterMat = this.own(
      new THREE.MeshStandardMaterial({
        color: 0x559d94,
        transparent: true,
        opacity: 0.65,
        roughness: 0.28,
      }),
    );
    this.waterMat.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "varying vec3 vHWaterPos;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vHWaterPos = position;`,
        );
      shader.fragmentShader =
        "varying vec3 vHWaterPos;\n" +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float ripple = sin(vHWaterPos.x * 14.0 + vHWaterPos.z * 14.0) * cos(vHWaterPos.x * 10.0 - vHWaterPos.z * 10.0) * 0.04;
          diffuseColor.rgb += vec3(ripple * 0.7, ripple * 0.9, ripple * 1.1);
          float glint = pow(max(0.0, ripple * 12.0 + 0.2), 3.5) * 0.25;
          diffuseColor.rgb += vec3(glint * 0.85, glint * 0.95, glint);`,
        );
    };
    this.waterMat.customProgramCacheKey = () => "frontier-habitat-water-v2";
    // Warm umber against pale bank and green reeds: the herd has to read as
    // animals first and vegetation never.
    this.animalMat = this.own(
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    );
    this.preyColors = Object.freeze({
      forage: new THREE.Color(0x8b6a45),
      "seek-water": new THREE.Color(0x9b7549),
      drink: new THREE.Color(0x66594b),
      parched: new THREE.Color(0xb69a6c),
      evade: new THREE.Color(0xa55f45),
      flee: new THREE.Color(0xa55f45),
    });
    // The basin visitors are frogs among reeds, so they keep the reed tone.
    this.frogMat = this.own(
      new THREE.MeshStandardMaterial({ color: 0x768e46, roughness: 1 }),
    );
    this.dummy = new THREE.Object3D();
    if (lab) this.buildLab();
    else this.buildFrontier();
    this.center = lab ? { x: 0, z: 0 } : WETLAND;
    this.reedLayout = Array.from({ length: 48 }, (_, i) => {
      const angle = i * 2.39996,
        radius = lab ? 2.8 + (i % 4) * 0.08 : 1 + (i % 8) * 0.28,
        x = this.center.x + Math.cos(angle) * radius,
        z = this.center.z + Math.sin(angle) * radius,
        h = 0.25 + (i % 5) * 0.12,
        y = lab ? labHeight(x, z) : heightAt(x, z);
      return { angle, x, z, h, y };
    });
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
    m.updateMatrix();
    m.matrixAutoUpdate = false;
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
    this.settlementHeight = h;
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
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }),
    );
    this.predatorColors = Object.freeze({
      stalk: new THREE.Color(0x38303b),
      ambush: new THREE.Color(0x241f29),
      watch: new THREE.Color(0x4a414a),
      evade: new THREE.Color(0x57404a),
    });
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
    // Deliberately compact: at creature scale a ~1.2 m figure should read as one mass.
    this.careTunic = this.own(
      new THREE.MeshStandardMaterial({ color: 0xd9c9a3, roughness: 1 }),
    );
    this.careTunic.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "varying vec3 vCarePos;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vCarePos = position;`,
        );
      shader.fragmentShader =
        "varying vec3 vCarePos;\n" +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float weave = sin(vCarePos.y * 64.0) * sin(vCarePos.x * 64.0) * 0.035;
          diffuseColor.rgb += vec3(weave);
          float trim = smoothstep(0.48, 0.52, abs(vCarePos.y)) * 0.12;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.45, 0.38, 0.28), trim);`,
        );
    };
    this.careTunic.customProgramCacheKey = () => "frontier-caretaker-tunic-v1";
    this.mesh(
      this.cylinder,
      this.careTunic,
      0,
      0.55,
      0,
      0.2,
      0.7,
      0.16,
      this.caretaker,
    );
    this.mesh(
      this.sphere,
      this.careTunic,
      0,
      1.03,
      0,
      0.15,
      0.17,
      0.15,
      this.caretaker,
    );
    for (const x of [-0.09, 0.09])
      this.mesh(
        this.box,
        this.wood,
        x,
        0.18,
        0,
        0.1,
        0.4,
        0.12,
        this.caretaker,
      );
    this.arm = this.mesh(
      this.box,
      this.careTunic,
      0.22,
      0.68,
      0,
      0.09,
      0.42,
      0.09,
      this.caretaker,
    );
    this.caretaker.position.set(a.x + 2.4, h, a.z + 2.4);
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
      a.z + 3.1,
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
      a.z + 3.1,
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
    this.animals = this.pool(this.sphere, this.frogMat, 12);
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
    this.visitorTarget = new THREE.Vector3(0, 0, 3.6);
  }
  part(pool, index, actor, ground, sin, cos, ox, oy, oz, sx, sy, sz) {
    const x = actor.x + cos * ox + sin * oz,
      z = actor.z - sin * ox + cos * oz;
    this.dummy.position.set(x, ground + oy, z);
    this.dummy.rotation.set(0, actor.yaw, 0);
    this.dummy.scale.set(sx, sy, sz);
    this.dummy.updateMatrix();
    pool.setMatrixAt(index, this.dummy.matrix);
  }
  update(
    ecosystem,
    body,
    time,
    notable = null,
    wildlife = null,
    settlement = null,
    dt = 1 / 60,
    environment = {},
  ) {
    if (this.visitor) {
      this.visitor.visible = !!notable;
      if (notable) {
        const desired =
            notable.fear > 0.25 ? 4.5 : notable.familiarity > 0.3 ? 3.5 : 4,
          angle = Math.atan2(body.x, body.z),
          approachRate =
            notable.fear > 0.25 ? 4.5 : notable.familiarity > 0.3 ? 2.8 : 1.8,
          hop =
            notable.fear > 0.25
              ? 0
              : Math.abs(
                  Math.sin(time * (2.2 + notable.familiarity * 2.2)),
                ) *
                (0.018 + notable.familiarity * 0.035),
          crouch = notable.fear > 0.25 ? 0.72 : 1;
        this.visitorTarget.set(
          Math.sin(angle) * desired,
          hop,
          Math.cos(angle) * desired,
        );
        this.visitor.position.x = THREE.MathUtils.damp(
          this.visitor.position.x,
          this.visitorTarget.x,
          approachRate,
          dt,
        );
        this.visitor.position.y = THREE.MathUtils.damp(
          this.visitor.position.y,
          this.visitorTarget.y,
          8,
          dt,
        );
        this.visitor.position.z = THREE.MathUtils.damp(
          this.visitor.position.z,
          this.visitorTarget.z,
          approachRate,
          dt,
        );
        this.visitor.rotation.y = Math.atan2(
          body.x - this.visitor.position.x,
          body.z - this.visitor.position.z,
        );
        this.visitor.scale.x = THREE.MathUtils.damp(
          this.visitor.scale.x,
          notable.fear > 0.25 ? 1.08 : 1,
          7,
          dt,
        );
        this.visitor.scale.y = THREE.MathUtils.damp(
          this.visitor.scale.y,
          crouch,
          7,
          dt,
        );
        this.visitor.scale.z = THREE.MathUtils.damp(
          this.visitor.scale.z,
          notable.fear > 0.25 ? 1.08 : 1,
          7,
          dt,
        );
        this.visitorMat.color.setHSL(0.12 + notable.marking * 0.015, 0.4, 0.55);
      }
    }
    const amount = this.lab ? ecosystem.labReeds : ecosystem.reeds;
    const life = this.lab ? ecosystem.labFrogs : ecosystem.prey;
    const windStrength = THREE.MathUtils.clamp(
        Number(environment.windStrength) || (this.lab ? 0.08 : 0.18),
        0.04,
        1,
      ),
      rawWindX = Number(environment.windX),
      rawWindZ = Number(environment.windZ),
      windLength = Math.hypot(
        Number.isFinite(rawWindX) ? rawWindX : 0.72,
        Number.isFinite(rawWindZ) ? rawWindZ : 0.38,
      ) || 1,
      windX = (Number.isFinite(rawWindX) ? rawWindX : 0.72) / windLength,
      windZ = (Number.isFinite(rawWindZ) ? rawWindZ : 0.38) / windLength,
      bodySpeed = Math.hypot(body.vx || 0, body.vz || 0),
      habitatWetness = THREE.MathUtils.clamp(
        Number(
          environment.wetness ??
            (this.lab ? ecosystem.labWater : ecosystem.reeds),
        ) || 0,
        0,
        1,
      );
    this.green.color.setHSL(
      0.27 + habitatWetness * 0.035,
      0.32 + habitatWetness * 0.12,
      0.26 - habitatWetness * 0.035,
    );
    const center = this.center;
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
          h = this.settlementHeight,
          targetX =
            mode === "withdraw"
              ? SETTLEMENT.x
              : mode === "check-water"
                ? SETTLEMENT.x + 2.4
                : SETTLEMENT.x + 2.9,
          targetZ =
            mode === "withdraw"
              ? SETTLEMENT.z + 1.8
              : mode === "check-water"
                ? SETTLEMENT.z + 3.4
                : SETTLEMENT.z + 2.6,
          a = 1 - Math.exp(-dt * 1.5);
        this.caretaker.position.x += (targetX - this.caretaker.position.x) * a;
        this.caretaker.position.z += (targetZ - this.caretaker.position.z) * a;
        this.caretaker.position.y = h + Math.sin(time * 1.8) * 0.012;
        this.caretaker.rotation.y = Math.atan2(
          body.x - this.caretaker.position.x,
          body.z - this.caretaker.position.z,
        );
        const wave = mode === "welcome" ? Math.sin(time * 4.2) * 0.16 : 0;
        this.arm.rotation.z =
          mode === "welcome"
            ? -1.1 + wave
            : mode === "withdraw"
              ? 0.4
              : mode === "check-water"
                ? -0.25
                : -0.15;
        this.caretaker.rotation.x =
          mode === "check-water"
            ? 0.22
            : mode === "withdraw"
              ? -0.06
              : mode === "welcome"
                ? Math.sin(time * 2.0) * 0.03
                : 0;
        this.door.visible = mode === "withdraw";
        this.bowl.visible = settlement.familiarity >= 0.25;
        this.bowlWater.visible = this.bowl.visible && settlement.bowl > 0.02;
        this.bowlWater.position.y = h + 0.1 + settlement.bowl * 0.09;
      }
      this.trough.visible = ecosystem.cistern > 0.03;
      this.trough.position.y =
        this.settlementHeight + 0.2 + ecosystem.cistern * 0.83;
    } else {
      this.basin.material.opacity = 0.25 + ecosystem.labWater * 0.45;
    }
    this.reeds.count = nearby ? Math.floor(amount * 48) : 0;
    for (let i = 0; i < this.reeds.count; i++) {
      const reed = this.reedLayout[i],
        angle = reed.angle,
        x = reed.x,
        z = reed.z,
        h = reed.h,
        y = reed.y,
        sway =
          Math.sin(time * 1.65 + i * 0.71) *
          windStrength *
          (0.08 + h * 0.12),
        dx = x - body.x,
        dz = z - body.z,
        distance = Math.hypot(dx, dz),
        proximity = Math.max(0, 1 - distance / 1.35),
        brushStrength =
          proximity *
          THREE.MathUtils.clamp(
            bodySpeed / 2.2 + (body.mode === "slide" ? 0.32 : 0),
            0,
            1,
          ),
        awayX = distance > 1e-4 ? dx / distance : Math.cos(angle),
        awayZ = distance > 1e-4 ? dz / distance : Math.sin(angle);
      this.dummy.position.set(x, y + h / 2, z);
      this.dummy.rotation.set(
        sway * windZ * 0.7 + awayZ * brushStrength * 0.42,
        angle,
        -sway * windX * 0.7 - awayX * brushStrength * 0.42,
      );
      this.dummy.scale.set(
        0.025,
        h * (0.9 + habitatWetness * 0.16),
        0.025,
      );
      this.dummy.updateMatrix();
      this.reeds.setMatrixAt(i, this.dummy.matrix);
    }
    if (!this.lab) {
      const meshes = [
        this.animals,
        this.preyHeads,
        this.preyLegs,
        this.predators,
        this.predatorHeads,
        this.predatorLegs,
      ];
      if (!nearby) {
        for (const mesh of meshes) {
          mesh.count = 0;
          mesh.visible = false;
        }
      } else {
        const agents = wildlife?.actors || [];
        let preyCount = 0,
          predatorCount = 0;
        for (let n = 0; n < agents.length; n++) {
          const actor = agents[n],
            ground = heightAt(actor.x, actor.z),
            sin = Math.sin(actor.yaw),
            cos = Math.cos(actor.yaw);
          if (actor.kind === "prey") {
            const i = preyCount++,
              drinking = actor.mode === "drink",
              color = this.preyColors[actor.mode] || this.preyColors.forage,
              hop =
                actor.mode === "forage" || drinking
                  ? 0
                  : Math.abs(
                      Math.sin(
                        time * (actor.mode === "parched" ? 6 : 12) +
                          actor.phase,
                      ),
                    ) * (actor.mode === "parched" ? 0.03 : 0.08),
              alert =
                actor.mode === "evade" || actor.mode === "flee"
                  ? 1
                  : actor.mode === "parched"
                    ? 0.5
                    : actor.mode === "seek-water"
                      ? 0.2
                      : 0;
            this.animals.setColorAt(i, color);
            this.preyHeads.setColorAt(i, color);
            this.preyLegs.setColorAt(i * 2, color);
            this.preyLegs.setColorAt(i * 2 + 1, color);
            this.part(
              this.animals,
              i,
              actor,
              ground,
              sin,
              cos,
              0,
              0.1 + hop + alert * 0.025 - (drinking ? 0.025 : 0),
              0,
              0.16,
              0.1 + alert * 0.018,
              0.23,
            );
            this.part(
              this.preyHeads,
              i,
              actor,
              ground,
              sin,
              cos,
              drinking ? 0.05 : 0,
              0.18 + hop + alert * 0.065 - (drinking ? 0.075 : 0),
              0.17 + (drinking ? 0.06 : 0) + alert * 0.025,
              0.14,
              0.09,
              0.12,
            );
            for (let j = 0; j < 2; j++)
              this.part(
                this.preyLegs,
                i * 2 + j,
                actor,
                ground,
                j ? 0.15 : -0.15,
                0.05 + hop,
                -0.12,
                0.1,
                0.04,
                0.17,
              );
          } else {
            const i = predatorCount++,
              color =
                this.predatorColors[actor.mode] || this.predatorColors.watch,
              crouch =
                actor.mode === "ambush"
                  ? 1
                  : actor.mode === "stalk"
                    ? 0.45
                    : 0;
            this.predators.setColorAt(i, color);
            this.predatorHeads.setColorAt(i, color);
            for (let j = 0; j < 4; j++)
              this.predatorLegs.setColorAt(i * 4 + j, color);
            this.part(
              this.predators,
              i,
              actor,
              ground,
              sin,
              cos,
              0,
              0.38 - crouch * 0.11,
              0,
              0.23,
              0.2 - crouch * 0.025,
              0.48 + crouch * 0.035,
            );
            this.part(
              this.predatorHeads,
              i,
              actor,
              ground,
              sin,
              cos,
              0,
              0.48 - crouch * 0.1,
              0.4 + crouch * 0.075,
              0.17,
              0.15 - crouch * 0.012,
              0.22,
            );
            for (let j = 0; j < 4; j++)
              this.part(
                this.predatorLegs,
                i * 4 + j,
                actor,
                ground,
                j % 2 ? 0.16 : -0.16,
                0.15 -
                  crouch * 0.075 +
                  (actor.mode === "stalk"
                    ? Math.sin(time * 9 + j) * 0.025
                    : 0),
                j < 2 ? 0.27 : -0.27,
                0.065,
                0.3 - crouch * 0.04,
                0.07,
              );
          }
        }
        this.animals.count = preyCount;
        this.preyHeads.count = preyCount;
        this.preyLegs.count = preyCount * 2;
        this.predators.count = predatorCount;
        this.predatorHeads.count = predatorCount;
        this.predatorLegs.count = predatorCount * 4;
        for (const mesh of meshes) {
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
      }
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
    if (this.reeds.count > 0) this.reeds.instanceMatrix.needsUpdate = true;
    if (this.animals.count > 0) this.animals.instanceMatrix.needsUpdate = true;
    // Zero-length instance batches still cost a draw call unless hidden outright.
    for (const mesh of this.instances) mesh.visible = mesh.count > 0;
  }
  performanceStats() {
    return {
      reeds: this.reeds.count,
      animals: this.animals.count,
      visiblePools: this.instances.reduce(
        (count, mesh) => count + (mesh.visible ? 1 : 0),
        0,
      ),
    };
  }
  dispose() {
    for (const m of this.instances) m.dispose();
    for (const r of this.resources) r.dispose();
    this.group.removeFromParent();
  }
}
