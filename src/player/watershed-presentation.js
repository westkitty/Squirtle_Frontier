import * as THREE from "three";
import { DEBRIS_SITE } from "../simulation/water-interaction.js";
import { heightAt } from "../worldgen.js";

// The watershed remains authoritative in simulation. This view owns only ordinary
// world geometry: the physical obstruction a Squirtle can encounter without a
// special perception mode.
export class WatershedPresentation {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.geometry = new THREE.IcosahedronGeometry(0.32, 0);
    this.material = new THREE.MeshStandardMaterial({
      color: 0x88745a,
      roughness: 1,
    });
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "varying vec3 vBldPos;\nvarying vec3 vBldNorm;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vBldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vBldNorm = normalize(mat3(modelMatrix) * normal);`,
        );
      shader.fragmentShader =
        "varying vec3 vBldPos;\nvarying vec3 vBldNorm;\n" +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float bldGrain = (sin(vBldPos.x * 14.0 + vBldPos.z * 11.0) * cos(vBldPos.y * 16.0)) * 0.04;
          diffuseColor.rgb += vec3(bldGrain * 0.9, bldGrain * 0.8, bldGrain * 0.6);
          float mudBase = smoothstep(0.35, -0.1, vBldPos.y) * 0.45;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.28, 0.20), mudBase);
          float mossTop = smoothstep(0.45, 0.85, vBldNorm.y) * 0.35;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.34, 0.44, 0.30), mossTop);`,
        );
    };
    this.material.customProgramCacheKey = () => "frontier-debris-boulder-v1";
    this.debris = new THREE.InstancedMesh(this.geometry, this.material, 9);
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.debris);
    this.dummy = new THREE.Object3D();
    this.baseX = new Float32Array(9);
    this.baseY = new Float32Array(9);
    this.baseZ = new Float32Array(9);
    for (let i = 0; i < 9; i++) {
      const x = DEBRIS_SITE.x + ((i % 3) - 1) * 0.38,
        z = DEBRIS_SITE.z + (Math.floor(i / 3) - 1) * 0.36,
        y = Math.max(-0.15, heightAt(x, z)) + 0.2;
      this.baseX[i] = x;
      this.baseY[i] = y;
      this.baseZ[i] = z;
      this.dummy.position.set(x, y, z);
      this.dummy.updateMatrix();
      this.debris.setMatrixAt(i, this.dummy.matrix);
    }
  }

  update(watershed, body, jetHit = null) {
    const node = watershed.nodes[1],
      hit = jetHit?.active && jetHit.kind === "debris",
      hitStrength = hit ? Math.max(0, Math.min(1, jetHit.intensity || 0)) : 0;
    this.group.visible =
      Math.hypot(body.x - DEBRIS_SITE.x, body.z - DEBRIS_SITE.z) < 55;
    this.debris.count = Math.ceil((node.blockage / 0.95) * 9);
    this.material.color.set(hit ? 0x71685d : 0x88745a);
    this.material.roughness = hit ? 0.72 : 1;
    for (let i = 0; i < this.debris.count; i++) {
      const phase = jetHit ? jetHit.serial * 0.7 + i * 1.9 : i,
        twitch = hit ? Math.sin(phase) * 0.045 * hitStrength : 0;
      this.dummy.position.set(
        this.baseX[i] + twitch,
        this.baseY[i] + Math.abs(twitch) * 0.45,
        this.baseZ[i] - twitch * 0.55,
      );
      this.dummy.rotation.set(hit ? twitch * 1.4 : 0, phase * 0.05, hit ? -twitch : 0);
      this.dummy.updateMatrix();
      this.debris.setMatrixAt(i, this.dummy.matrix);
    }
    this.debris.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.debris.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.group.removeFromParent();
  }
}
