import * as THREE from "three";
import { DEBRIS_SITE } from "../simulation/water-interaction.js";
import { heightAt } from "../worldgen.js";
import { REACHES, reachAt, reachById } from "../simulation/reaches.js";

function pointAlong(reach, along) {
  if (!reach?.points?.length) return null;
  const target = THREE.MathUtils.clamp(along, 0, reach.length);
  for (let i = 1; i < reach.points.length; i++) {
    const a = reach.points[i - 1],
      b = reach.points[i];
    if (target > b.along) continue;
    const span = Math.max(1e-6, b.along - a.along),
      t = THREE.MathUtils.clamp((target - a.along) / span, 0, 1);
    return {
      x: THREE.MathUtils.lerp(a.x, b.x, t),
      z: THREE.MathUtils.lerp(a.z, b.z, t),
    };
  }
  const last = reach.points.at(-1);
  return { x: last.x, z: last.z };
}
// Fixed-size local presentation; graph remains authoritative and exists when hidden.
export class WatershedPresentation {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.geometry = new THREE.IcosahedronGeometry(0.32, 0);
    this.material = new THREE.MeshStandardMaterial({
      color: 0x88745a,
      roughness: 1,
    });
    this.debris = new THREE.InstancedMesh(this.geometry, this.material, 9);
    this.group.add(this.debris);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 9; i++) {
      const x = DEBRIS_SITE.x + ((i % 3) - 1) * 0.38,
        z = DEBRIS_SITE.z + (Math.floor(i / 3) - 1) * 0.36;
      dummy.position.set(x, Math.max(-0.15, heightAt(x, z)) + 0.2, z);
      dummy.updateMatrix();
      this.debris.setMatrixAt(i, dummy.matrix);
    }
    this.ripple = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.62, 32),
      new THREE.MeshBasicMaterial({
        color: 0xf3cf82,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    this.ripple.rotation.x = -Math.PI / 2;
    this.ripple.position.set(DEBRIS_SITE.x, 0.06, DEBRIS_SITE.z);
    this.group.add(this.ripple);
    // The whole network shares one LineSegments: a geometry per reach would cost
    // more than the legibility it buys.
    const ranges = [];
    for (const reach of REACHES)
      ranges.push({ id: reach.id, cut: !!reach.cut, from: 0, to: 0 });
    const segments = REACHES.reduce(
      (total, reach) => total + reach.points.length - 1,
      0,
    );
    this.reachGeometry = new THREE.BufferGeometry();
    this.reachPositions = new Float32Array(segments * 2 * 3);
    this.reachColors = new Float32Array(segments * 2 * 3);
    this.reachRanges = ranges;
    let vertex = 0;
    for (const range of ranges) {
      const reach = REACHES.find((r) => r.id === range.id);
      range.from = vertex;
      for (let i = 1; i < reach.points.length; i++)
        for (const p of [reach.points[i - 1], reach.points[i]]) {
          this.reachPositions[vertex * 3] = p.x;
          this.reachPositions[vertex * 3 + 1] = heightAt(p.x, p.z) + 0.12;
          this.reachPositions[vertex * 3 + 2] = p.z;
          vertex++;
        }
      range.to = vertex;
    }
    this.reachGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.reachPositions, 3),
    );
    this.reachGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(this.reachColors, 3),
    );
    this.reachMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    this.reachLines = new THREE.LineSegments(
      this.reachGeometry,
      this.reachMaterial,
    );
    this.group.add(this.reachLines);
    this.flowMaterial = new THREE.MeshBasicMaterial({
      color: 0x9fdcff,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    this.flowMotes = new THREE.InstancedMesh(
      this.geometry,
      this.flowMaterial,
      12,
    );
    this.flowMotes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.flowMotes.frustumCulled = false;
    this.flowMotes.count = 0;
    this.flowMotes.visible = false;
    this.group.add(this.flowMotes);
    this.flowDummy = new THREE.Object3D();
    this.reachSeen = null;
    this.paintReaches([], 0);
  }
  // One colour for where water is and one brightness for what you have walked: the line
  // is a map of the basin's inflows, not a score, so the water signal wins the hue.
  paintReaches(seen, stage, water = {}) {
    const dim = new THREE.Color(0x40645d),
      lit = new THREE.Color(0x9fd8c0),
      running = new THREE.Color(0x6fb6d8),
      cut = new THREE.Color(0xf3cf82),
      dryCut = new THREE.Color(0x6b5a3f);
    for (const range of this.reachRanges) {
      const flow = water[range.id];
      const color = (
        range.cut
          ? stage > 0
            ? flow?.flowing
              ? cut
              : dryCut
            : dim
          : flow?.flowing
            ? running
            : flow && flow.fraction > 0
              ? running.clone().lerp(dim, 0.55)
              : seen.includes(range.id)
                ? lit
                : dim
      ).clone();
      if (!range.cut && seen.includes(range.id)) color.lerp(lit, 0.45);
      for (let v = range.from; v < range.to; v++) {
        this.reachColors[v * 3] = color.r;
        this.reachColors[v * 3 + 1] = color.g;
        this.reachColors[v * 3 + 2] = color.b;
      }
    }
    this.reachGeometry.attributes.color.needsUpdate = true;
  }
  update(
    watershed,
    body,
    sensing,
    time,
    seen = [],
    stage = 0,
    water = {},
    senseHeld = sensing,
  ) {
    const node = watershed.nodes[1],
      localReach = reachAt(body.x, body.z, 8),
      flows = REACHES.map(
        (r) =>
          `${r.id}:${water[r.id]?.flowing ? 1 : (water[r.id]?.fraction ?? 0) > 0 ? 2 : 0}`,
      ).join(",");
    this.group.visible =
      Math.hypot(body.x - DEBRIS_SITE.x, body.z - DEBRIS_SITE.z) < 55 ||
      (senseHeld && !!localReach);
    const signature = `${stage}|${seen.join(",")}|${flows}`;
    if (signature !== this.reachSeen) {
      this.reachSeen = signature;
      this.paintReaches(seen, stage, water);
    }
    this.reachLines.visible = Math.hypot(body.x, body.z) < 72;
    this.debris.count = Math.ceil((node.blockage / 0.95) * 9);
    this.ripple.visible = sensing && node.blockage > 0.1;
    this.ripple.scale.setScalar(1 + (time % 2) * 0.8);
    this.ripple.material.opacity = 1 - (time % 2) / 2;

    const localFlow = localReach ? water[localReach.id] : null,
      activeFlow =
        !!localReach &&
        senseHeld &&
        (localFlow?.flowing || (localFlow?.fraction ?? 0) > 0),
      reach = activeFlow ? reachById(localReach.id) : null;
    if (reach) {
      const count = 10,
        windowStart = Math.max(0, localReach.toHead - 2.2),
        windowLength = Math.max(
          0.5,
          Math.min(9, reach.length - windowStart),
        ),
        flowStrength = localFlow?.flowing
          ? 1
          : THREE.MathUtils.clamp(localFlow?.fraction ?? 0, 0.2, 1);
      this.flowMotes.count = count;
      this.flowMotes.visible = true;
      this.flowMaterial.opacity = 0.42 + flowStrength * 0.42;
      for (let i = 0; i < count; i++) {
        const phase =
            (((time * (0.55 + flowStrength * 0.85) +
              (i / count) * windowLength) %
              windowLength) +
              windowLength) %
            windowLength,
          p = pointAlong(reach, windowStart + phase);
        this.flowDummy.position.set(
          p.x,
          heightAt(p.x, p.z) + 0.18 + Math.sin(time * 4 + i) * 0.025,
          p.z,
        );
        this.flowDummy.rotation.set(0, time * 0.8 + i, 0);
        this.flowDummy.scale.setScalar(0.09 + flowStrength * 0.035);
        this.flowDummy.updateMatrix();
        this.flowMotes.setMatrixAt(i, this.flowDummy.matrix);
      }
      this.flowMotes.instanceMatrix.needsUpdate = true;
    } else {
      this.flowMotes.count = 0;
      this.flowMotes.visible = false;
    }
  }
  dispose() {
    this.debris.dispose();
    this.reachGeometry.dispose();
    this.reachMaterial.dispose();
    this.flowMotes.dispose();
    this.flowMaterial.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.ripple.geometry.dispose();
    this.ripple.material.dispose();
    this.group.removeFromParent();
  }
}
