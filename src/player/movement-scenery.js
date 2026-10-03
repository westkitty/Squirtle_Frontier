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
      color: 0x665743,
      roughness: 1,
    });
    this.leafMat = new THREE.MeshStandardMaterial({
      color: 0x294d43,
      roughness: 1,
    });
    this.rockMat = new THREE.MeshStandardMaterial({
      color: 0x869185,
      roughness: 1,
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
      color: 0x419b96,
      transparent: true,
      opacity: 0.6,
      roughness: 0.25,
      metalness: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    // The mesh owns no geometry until the first measurement, because the geometry *is*
    // the measurement: a silhouette resolved through the predicate the body swims by.
    this.water = new THREE.Mesh(new THREE.BufferGeometry(), this.waterMaterial);
    this.water.position.y = WATER_SURFACE_Y(WATER_BASE);
    scene.add(this.water);
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
    this.water.geometry.dispose();
    this.water.geometry = geometry;
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
        trees.length * 3,
      ),
      o = new THREE.Object3D();
    trees.forEach((t, i) => {
      const y = heightAt(t.x, t.z);
      o.position.set(t.x, y + t.h / 2, t.z);
      o.scale.set(1, t.h, 1);
      o.updateMatrix();
      trunks.setMatrixAt(i, o.matrix);
      for (let j = 0; j < 3; j++) {
        o.position.set(t.x, y + t.h * 0.4 + j * t.h * 0.21, t.z);
        const w = (1 - j * 0.22) * t.h * 0.26;
        o.scale.set(w, t.h * 0.48, w);
        o.updateMatrix();
        leaves.setMatrixAt(i * 3 + j, o.matrix);
        leaves.setColorAt(
          i * 3 + j,
          new THREE.Color().setHSL(0.4, 0.24, 0.2 + (i % 5) * 0.018),
        );
      }
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
        mesh.scale.set(rock.radius, rock.height * 0.6, rock.radius);
        group.add(mesh);
      }
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
  update(body, dt, level = null) {
    if (level !== null) {
      this.water.position.y = WATER_SURFACE_Y(level);
      this.buildWater(level);
    }
    const ground = heightAt(body.x, body.z),
      depth = body.y - ground;
    this.contact.visible = ground > -0.1 && depth < 1.5;
    this.contact.position.set(body.x, ground + 0.025, body.z);
    this.contact.material.opacity = Math.max(0, 1 - depth * 0.5);
    this.particleTime += dt;
    const active = body.jetTime > 0 || body.mode === "swim" || body.impact > 0;
    this.pool.count = active ? 32 : 0;
    for (let i = 0; i < this.pool.count; i++) {
      const t = (this.particleTime * 2 + i / 32) % 1;
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
      this.pool.geometry,
      this.pool.material,
    ])
      r.dispose();
    this.pool.dispose();
    this.pool.removeFromParent();
    this.water.removeFromParent();
    this.contact.geometry.dispose();
    this.contact.material.dispose();
    this.contactTexture.dispose();
    this.contact.removeFromParent();
  }
}
