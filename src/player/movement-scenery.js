import * as THREE from "three";
import { WATER_BASE, WATER_SURFACE_Y } from "../simulation/water-level.js";
import { heightAt, WORLD } from "../worldgen.js";
import { obstacles, treesForChunk } from "./movement-region.js";
import { levelChanged, pondOutline } from "./pond-surface.js";
// Presentation-only training landmarks. Each grove is owned by its streamed chunk.
export class MovementScenery {
  constructor(scene, streaming) {
    this.scene = scene;
    this.streaming = streaming;
    this.groups = new Map();
    this.trunkGeo = new THREE.CylinderGeometry(0.2, 0.32, 1, 6);
    this.leafGeo = new THREE.ConeGeometry(1, 1, 7);
    this.rockGeo = new THREE.IcosahedronGeometry(1, 1);
    this.trunkMat = new THREE.MeshStandardMaterial({
      color: 0x523f31,
      roughness: 0.96,
    });
    this.leafMat = new THREE.MeshStandardMaterial({
      color: 0x315d42,
      roughness: 0.92,
    });
    this.leafUniforms = {
      time: { value: 0 },
      wind: { value: 0.18 },
      player: { value: new THREE.Vector2() },
      brush: { value: 0 },
    };
    this.leafMat.onBeforeCompile = (shader) => {
      shader.uniforms.uLeafTime = this.leafUniforms.time;
      shader.uniforms.uLeafWind = this.leafUniforms.wind;
      shader.uniforms.uLeafPlayer = this.leafUniforms.player;
      shader.uniforms.uLeafBrush = this.leafUniforms.brush;
      shader.vertexShader =
        "uniform float uLeafTime;\nuniform float uLeafWind;\nuniform vec2 uLeafPlayer;\nuniform float uLeafBrush;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
#ifdef USE_INSTANCING
          vec3 leafAnchor = vec3(instanceMatrix[3].x, instanceMatrix[3].y, instanceMatrix[3].z);
#else
          vec3 leafAnchor = vec3(0.0);
#endif
          float leafPhase = uLeafTime * 1.7 + leafAnchor.x * 0.19 + leafAnchor.z * 0.13;
          float leafSway = sin(leafPhase + position.y * 1.8) * uLeafWind * max(0.0, position.y) * 0.055;
          transformed.x += leafSway;
          transformed.z += leafSway * 0.55;
          vec2 leafDelta = leafAnchor.xz - uLeafPlayer;
          float leafDist = length(leafDelta);
          vec2 leafAway = leafDist > 0.001 ? leafDelta / leafDist : vec2(1.0, 0.0);
          float leafBrush = (1.0 - smoothstep(0.0, 1.8, leafDist)) * uLeafBrush;
          transformed.x += leafAway.x * leafBrush * 0.12 * max(0.2, position.y);
          transformed.z += leafAway.y * leafBrush * 0.12 * max(0.2, position.y);`,
        );
    };
    this.leafMat.customProgramCacheKey = () => "frontier-leaf-wind-v2";
    this.rockMat = new THREE.MeshStandardMaterial({
      color: 0x71817a,
      roughness: 0.94,
      flatShading: true,
    });
    const previousBuild = streaming.chunks.onChunkBuild,
      previousRemove = streaming.chunks.onChunkRemove;
    streaming.chunks.onChunkBuild = (key, rec, ring) => {
      previousBuild(key, rec, ring);
      this.build(key, rec);
    };
    streaming.chunks.onChunkRemove = (key, rec) => {
      previousRemove(key, rec);
      this.remove(key);
    };
    this.waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x2f7f83,
      transparent: true,
      opacity: 0.68,
      roughness: 0.18,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.waterUniforms = {
      time: { value: 0 },
      ripple: { value: 0.32 },
    };
    this.waterMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uPondTime = this.waterUniforms.time;
      shader.uniforms.uPondRipple = this.waterUniforms.ripple;
      shader.vertexShader =
        "uniform float uPondTime;\nuniform float uPondRipple;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          float pondWave =
            sin(position.x * 0.72 + uPondTime * 1.45) *
            cos(position.z * 0.58 - uPondTime * 1.1);
          transformed.y += pondWave * 0.018 * uPondRipple;`,
        );
    };
    this.waterMaterial.customProgramCacheKey = () => "frontier-pond-ripple-v1";
    // The mesh owns no geometry until the first measurement, because the geometry *is*
    // the measurement: a silhouette resolved through the predicate the body swims by.
    this.water = new THREE.Mesh(new THREE.BufferGeometry(), this.waterMaterial);
    this.water.position.y = WATER_SURFACE_Y(WATER_BASE);
    this.shoreMaterial = new THREE.LineBasicMaterial({
      color: 0xb8e5dd,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const shoreGeometry = new THREE.BufferGeometry();
    this.shore = new THREE.LineLoop(shoreGeometry, this.shoreMaterial);
    this.shore.position.y = WATER_SURFACE_Y(WATER_BASE) + 0.025;
    this.shoreLapMaterial = new THREE.LineBasicMaterial({
      color: 0xd9f3ed,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    this.shoreLap = new THREE.LineLoop(shoreGeometry, this.shoreLapMaterial);
    this.shoreLap.position.y = WATER_SURFACE_Y(WATER_BASE) + 0.032;
    scene.add(this.water, this.shore, this.shoreLap);
    this.waterLevel = null;
    this.buildWater(WATER_BASE);
    this.pool = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.035, 4, 3),
      new THREE.MeshBasicMaterial({
        color: 0xd4ffff,
        transparent: true,
        opacity: 0.65,
      }),
      32,
    );
    this.pool.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pool.frustumCulled = false;
    scene.add(this.pool);
    this.dummy = new THREE.Object3D();
    this.particleTime = 0;
    const pixels = new Uint8Array(32 * 32 * 4);
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const a = (y * 32 + x) * 4,
          d = Math.hypot((x - 15.5) / 15.5, (y - 15.5) / 15.5);
        pixels[a + 3] = Math.round(Math.max(0, 1 - d) ** 2 * 130);
      }
    this.contactTexture = new THREE.DataTexture(
      pixels,
      32,
      32,
      THREE.RGBAFormat,
    );
    this.contactTexture.needsUpdate = true;
    this.contact = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.8),
      new THREE.MeshBasicMaterial({
        map: this.contactTexture,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    this.contact.rotation.x = -Math.PI / 2;
    scene.add(this.contact);

    this.wetTrailMaterial = new THREE.MeshBasicMaterial({
      map: this.contactTexture,
      color: 0x456b68,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.wetTrail = new THREE.InstancedMesh(
      this.contact.geometry,
      this.wetTrailMaterial,
      12,
    );
    this.wetTrail.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wetTrail.frustumCulled = false;
    this.wetTrail.count = 0;
    this.wetTrail.visible = false;
    scene.add(this.wetTrail);
    this.wetMarks = [];
    this.wasSubmerged = false;
    this.wetTrailRemaining = 0;
    this.lastWetMark = null;
    this.wetStep = 0;
    this.wetTrailColor = new THREE.Color();
  }
  // Re-resolved only when the basin's level actually moves. A repair moves it by up to
  // 0.28 m, which walks the shoreline several body-lengths up or down the bank, so the
  // rebuild is rare and each one is visible.
  buildWater(level) {
    if (!levelChanged(this.waterLevel, level)) return false;
    const { spokes, rings, radii } = pondOutline(level);
    const count = 1 + spokes * rings,
      positions = new Float32Array(count * 3),
      normals = new Float32Array(count * 3),
      indices = new Uint32Array(spokes * (2 * rings - 1) * 3);
    // One fan vertex at the centre, then one ring per radial step. Every ring carries the
    // same spoken directions, so the outer ring is the shore and nothing can overshoot it.
    for (let s = 0; s < spokes; s++) normals[s * 3 + 1] = 1;
    for (let k = 1; k <= rings; k++) {
      const t = k / rings;
      for (let s = 0; s < spokes; s++) {
        const angle = (s / spokes) * Math.PI * 2,
          r = radii[s] * t,
          i = 1 + (k - 1) * spokes + s;
        positions[i * 3] = Math.cos(angle) * r;
        positions[i * 3 + 2] = Math.sin(angle) * r;
        normals[i * 3 + 1] = 1;
      }
    }
    let p = 0;
    for (let s = 0; s < spokes; s++) {
      indices[p++] = 0;
      indices[p++] = 1 + ((s + 1) % spokes);
      indices[p++] = 1 + s;
    }
    for (let k = 1; k < rings; k++) {
      const base = 1 + (k - 1) * spokes,
        next = base + spokes;
      for (let s = 0; s < spokes; s++) {
        const s2 = (s + 1) % spokes,
          a = base + s,
          b = base + s2,
          c = next + s,
          d = next + s2;
        indices[p++] = a;
        indices[p++] = b;
        indices[p++] = c;
        indices[p++] = b;
        indices[p++] = d;
        indices[p++] = c;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeBoundingSphere();

    // The edge is not a second authored approximation. It is the same measured
    // outer ring rendered as a line so a changing basin reads clearly at body scale.
    const shorePositions = new Float32Array(spokes * 3);
    for (let s = 0; s < spokes; s++) {
      const angle = (s / spokes) * Math.PI * 2,
        r = radii[s];
      shorePositions[s * 3] = Math.cos(angle) * r;
      shorePositions[s * 3 + 2] = Math.sin(angle) * r;
    }
    const shoreGeometry = new THREE.BufferGeometry();
    shoreGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(shorePositions, 3),
    );
    shoreGeometry.computeBoundingSphere();

    this.water.geometry.dispose();
    this.water.geometry = geometry;
    this.shore.geometry.dispose();
    this.shore.geometry = shoreGeometry;
    this.shoreLap.geometry = shoreGeometry;
    this.waterLevel = level;
    return true;
  }
  build(key, rec) {
    const trees = treesForChunk(rec.i, rec.j);
    const group = new THREE.Group(),
      trunks = new THREE.InstancedMesh(
        this.trunkGeo,
        this.trunkMat,
        trees.length,
      ),
      leaves = new THREE.InstancedMesh(
        this.leafGeo,
        this.leafMat,
        trees.length * 4,
      ),
      o = new THREE.Object3D();
    trees.forEach((t, i) => {
      const y = heightAt(t.x, t.z),
        lean = Math.sin(t.x * 0.73 + t.z * 0.41) * 0.055,
        twist = (t.x * 0.31 + t.z * 0.17 + i * 0.91) % (Math.PI * 2);
      o.position.set(t.x, y + t.h / 2, t.z);
      o.rotation.set(lean * 0.55, twist, -lean);
      o.scale.set(0.82 + (i % 3) * 0.06, t.h, 0.78 + ((i + 1) % 3) * 0.07);
      o.updateMatrix();
      trunks.setMatrixAt(i, o.matrix);
      for (let j = 0; j < 3; j++) {
        const lateral = Math.sin(i * 2.17 + j * 1.73) * t.h * 0.035,
          depth = Math.cos(i * 1.61 + j * 2.11) * t.h * 0.03;
        o.position.set(
          t.x + lateral,
          y + t.h * 0.38 + j * t.h * 0.205,
          t.z + depth,
        );
        const w = (1 - j * 0.2) * t.h * 0.25;
        o.rotation.set(lean * 0.25, twist + j * 1.7, -lean * 0.2);
        o.scale.set(
          w * (0.88 + ((i + j) % 3) * 0.08),
          t.h * (0.36 + j * 0.035),
          w * (0.72 + ((i + j * 2) % 4) * 0.07),
        );
        o.updateMatrix();
        leaves.setMatrixAt(i * 3 + j, o.matrix);
        leaves.setColorAt(
          i * 3 + j,
          new THREE.Color().setHSL(
            0.31 + ((i * 3 + j) % 6) * 0.012,
            0.31 + ((i + j) % 3) * 0.035,
            0.18 + ((i * 2 + j) % 5) * 0.018,
          ),
        );
      }
      const bush = trees.length * 3 + i,
        bx = t.x + Math.sin(i * 2.73 + t.z) * 1.45,
        bz = t.z + Math.cos(i * 2.19 + t.x) * 1.45;
      o.position.set(bx, heightAt(bx, bz) + 0.22, bz);
      o.rotation.set(0, twist * 1.7, lean * 0.2);
      o.scale.set(0.34 + (i % 3) * 0.08, 0.44 + (i % 4) * 0.05, 0.3);
      o.updateMatrix();
      leaves.setMatrixAt(bush, o.matrix);
      leaves.setColorAt(
        bush,
        new THREE.Color().setHSL(0.28 + (i % 5) * 0.014, 0.34, 0.2),
      );
    });
    group.add(trunks, leaves);
    for (const rock of obstacles)
      if (
        Math.floor(rock.x / WORLD.chunk) === rec.i &&
        Math.floor(rock.z / WORLD.chunk) === rec.j
      ) {
        const mesh = new THREE.Mesh(this.rockGeo, this.rockMat);
        mesh.position.set(
          rock.x,
          heightAt(rock.x, rock.z) + rock.height * 0.4,
          rock.z,
        );
        mesh.rotation.set(
          Math.sin(rock.x * 0.4) * 0.12,
          (rock.x * 0.23 + rock.z * 0.17) % (Math.PI * 2),
          Math.cos(rock.z * 0.35) * 0.1,
        );
        mesh.scale.set(
          rock.radius * (0.86 + Math.abs(Math.sin(rock.x)) * 0.28),
          rock.height * 0.55,
          rock.radius * (0.78 + Math.abs(Math.cos(rock.z)) * 0.3),
        );
        group.add(mesh);
      }
    group.userData.trees = trees;
    this.groups.set(key, group);
    this.scene.add(group);
  }
  remove(key) {
    const group = this.groups.get(key);
    if (!group) return;
    group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
    group.removeFromParent();
    this.groups.delete(key);
  }
  canopyCoverAt(x, z) {
    let cover = 0;
    for (const group of this.groups.values())
      for (const tree of group.userData?.trees || []) {
        const distance = Math.hypot(tree.x - x, tree.z - z);
        if (distance >= 3.2) continue;
        const heightWeight = THREE.MathUtils.clamp((tree.h || 1) / 4, 0.45, 1);
        cover = Math.max(
          cover,
          (1 - distance / 3.2) * heightWeight,
        );
      }
    return THREE.MathUtils.clamp(cover, 0, 1);
  }
  update(body, dt, level = null, effectScale = 1, environment = {}) {
    const surface = level !== null ? WATER_SURFACE_Y(level) : null;
    if (surface !== null) {
      this.water.position.y = surface;
      this.shore.position.y = surface + 0.025;
      this.shoreLap.position.y = surface + 0.032;
      this.buildWater(level);
    }
    const ground = heightAt(body.x, body.z),
      depth = Math.max(0, body.y - ground),
      speed = Math.hypot(body.vx, body.vz),
      submerged =
        surface !== null && ground < surface && body.y <= surface + 0.12,
      lift = THREE.MathUtils.clamp(depth / 1.5, 0, 1),
      slideStretch =
        body.mode === "slide"
          ? THREE.MathUtils.clamp(1 + speed * 0.08, 1, 1.45)
          : 1,
      shadowScale = 1 - lift * 0.28;
    this.contact.visible = !submerged && ground > -0.1 && depth < 1.5;
    this.contact.position.set(body.x, ground + 0.025, body.z);
    this.contact.rotation.set(-Math.PI / 2, 0, body.yaw);
    this.contact.scale.set(
      0.9 * slideStretch * shadowScale,
      0.9 * shadowScale,
      1,
    );
    this.contact.material.opacity =
      (body.mode === "slide" ? 0.78 : 0.58) * (1 - lift) ** 1.5;

    if (submerged) {
      this.wetTrailRemaining = 4.5;
      this.lastWetMark = null;
    } else {
      this.wetTrailRemaining = Math.max(0, this.wetTrailRemaining - dt);
    }
    if (
      this.wasSubmerged &&
      !submerged &&
      body.grounded &&
      ground > -0.1
    ) {
      this.wetTrailRemaining = Math.max(this.wetTrailRemaining, 4.5);
      this.lastWetMark = null;
    }
    this.wasSubmerged = submerged;
    for (const mark of this.wetMarks) mark.age += dt;
    this.wetMarks = this.wetMarks.filter((mark) => mark.age < mark.life);
    if (
      !submerged &&
      body.grounded &&
      ground > -0.1 &&
      speed > 0.12 &&
      this.wetTrailRemaining > 0
    ) {
      const distance = this.lastWetMark
        ? Math.hypot(body.x - this.lastWetMark.x, body.z - this.lastWetMark.z)
        : Infinity;
      if (distance >= 0.34) {
        const side = (this.wetStep++ % 2 ? 1 : -1) * 0.075,
          x = body.x + Math.cos(body.yaw) * side,
          z = body.z - Math.sin(body.yaw) * side;
        this.wetMarks.push({
          x,
          z,
          y: ground + 0.029,
          yaw: body.yaw,
          age: 0,
          life: 4 + THREE.MathUtils.clamp(Number(environment.wetGround) || 0, 0, 1) * 2,
        });
        if (this.wetMarks.length > 12) this.wetMarks.shift();
        this.lastWetMark = { x: body.x, z: body.z };
      }
    }
    this.wetTrail.count = this.wetMarks.length;
    this.wetTrail.visible = this.wetTrail.count > 0;
    for (let i = 0; i < this.wetTrail.count; i++) {
      const mark = this.wetMarks[i],
        fade = THREE.MathUtils.clamp(1 - mark.age / mark.life, 0, 1);
      this.dummy.position.set(mark.x, mark.y, mark.z);
      this.dummy.rotation.set(-Math.PI / 2, 0, mark.yaw);
      this.dummy.scale.set(0.34 * fade, 0.46 * fade, 1);
      this.dummy.updateMatrix();
      this.wetTrail.setMatrixAt(i, this.dummy.matrix);
      this.wetTrailColor.setHSL(0.49, 0.24, 0.22 + (1 - fade) * 0.1);
      this.wetTrail.setColorAt(i, this.wetTrailColor);
    }
    this.wetTrail.instanceMatrix.needsUpdate = true;
    if (this.wetTrail.instanceColor)
      this.wetTrail.instanceColor.needsUpdate = true;

    this.particleTime += dt;
    this.leafUniforms.time.value = this.particleTime;
    this.leafUniforms.wind.value = THREE.MathUtils.clamp(
      Number(environment.windStrength) || 0.18,
      0.08,
      1,
    );
    this.leafUniforms.player.value.set(body.x, body.z);
    this.leafUniforms.brush.value = THREE.MathUtils.clamp(
      speed / 2.5 + (body.mode === "slide" ? 0.25 : 0),
      0,
      1,
    );
    const wetGround = THREE.MathUtils.clamp(
      Number(environment.wetGround) || 0,
      0,
      1,
    );
    this.leafMat.color.setHSL(
      0.34 - wetGround * 0.012,
      0.31 + wetGround * 0.08,
      0.28 - wetGround * 0.055,
    );
    this.waterUniforms.time.value = this.particleTime;
    this.waterUniforms.ripple.value = THREE.MathUtils.clamp(
      Number(environment.rippleStrength) || 0.32,
      0.12,
      1,
    );
    this.waterMaterial.roughness = THREE.MathUtils.clamp(
      Number(environment.waterRoughness) || 0.18,
      0.12,
      0.52,
    );
    const shoreMotion = this.waterUniforms.ripple.value;
    this.shoreLap.scale.setScalar(
      1 + Math.sin(this.particleTime * 2.1) * 0.0018 * shoreMotion,
    );
    this.shoreLapMaterial.opacity = 0.06 + shoreMotion * 0.2;
    // Wake and impact water belong to WorldEffects. This particle stream is Jet-only:
    // ordinary walking/swimming must never look like Squirtle is firing Water Jet.
    const active = body.jetTime > 0,
      particleScale = Math.max(
        0.2,
        Math.min(1, Number(effectScale) || 1),
      );
    this.pool.count = active
      ? Math.max(8, Math.round(32 * particleScale))
      : 0;
    for (let i = 0; i < this.pool.count; i++) {
      const t =
        (this.particleTime * 2 + i / Math.max(1, this.pool.count)) % 1;
      const behind = body.jetTime > 0 ? t * 2 : t * 0.45;
      this.dummy.position.set(
        body.x - Math.sin(body.yaw) * behind + Math.sin(i * 7) * t * 0.3,
        body.y + 0.15 + Math.sin(t * Math.PI) * 0.25,
        body.z - Math.cos(body.yaw) * behind + Math.cos(i * 5) * t * 0.3,
      );
      this.dummy.scale.setScalar((1 - t) * 1.4);
      this.dummy.updateMatrix();
      this.pool.setMatrixAt(i, this.dummy.matrix);
    }
    this.pool.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    for (const key of [...this.groups.keys()]) this.remove(key);
    for (const r of [
      this.trunkGeo,
      this.leafGeo,
      this.rockGeo,
      this.trunkMat,
      this.leafMat,
      this.rockMat,
      this.water.geometry,
      this.waterMaterial,
      this.shore.geometry,
      this.shoreMaterial,
      this.shoreLapMaterial,
      this.pool.geometry,
      this.pool.material,
    ])
      r.dispose();
    this.pool.dispose();
    this.pool.removeFromParent();
    this.wetTrail.dispose();
    this.wetTrail.removeFromParent();
    this.water.removeFromParent();
    this.shore.removeFromParent();
    this.shoreLap.removeFromParent();
    this.contact.geometry.dispose();
    this.contact.material.dispose();
    this.wetTrailMaterial.dispose();
    this.contactTexture.dispose();
    this.contact.removeFromParent();
  }
}
