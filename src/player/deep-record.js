import * as THREE from "three";
import { RECORD_DEPTH, deepHistory } from "../simulation/deep-history.js";
export const recordRegion = {
  sample: () => ({ height: -RECORD_DEPTH, dx: 0, dz: 0 }),
  water: () => ({ level: 0, currentX: 0, currentZ: 0 }),
  obstacles: Array.from({ length: 48 }, (_, i) => ({
    x: Math.sin((i * Math.PI) / 24) * 4,
    z: Math.cos((i * Math.PI) / 24) * 4,
    radius: 0.28,
    height: 23,
  })),
};
export class DeepRecord {
  constructor(scene, seed) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.eras = deepHistory(seed);
    this.geo = new THREE.CylinderGeometry(4, 4, 2.31, 16, 1, true);
    this.materials = [];
    for (const e of this.eras) {
      const mat = new THREE.MeshStandardMaterial({
        color: [0x8a8b71, 0x826b51, 0x607875, 0x62645c][e.material],
        side: THREE.BackSide,
        roughness: 1,
      });
      mat.onBeforeCompile = (shader) => {
        shader.vertexShader =
          "varying vec3 vStrataPos;\n" +
          shader.vertexShader.replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
            vStrataPos = position;`,
          );
        shader.fragmentShader =
          "varying vec3 vStrataPos;\n" +
          shader.fragmentShader.replace(
            "#include <color_fragment>",
            `#include <color_fragment>
            float layerBands = sin(vStrataPos.y * 28.0 + sin(vStrataPos.x * 5.0) * 1.2) * 0.055;
            float microLam = sin(vStrataPos.y * 72.0 + vStrataPos.z * 8.0) * 0.025;
            diffuseColor.rgb += vec3(layerBands * 0.85, layerBands * 0.75, layerBands * 0.6) + vec3(microLam);`,
          );
      };
      mat.customProgramCacheKey = () => `frontier-strata-${e.material}-v1`;
      this.materials.push(mat);
      const m = new THREE.Mesh(this.geo, mat);
      m.position.y = -e.depth;
      this.group.add(m);
    }
    this.floorGeo = new THREE.CircleGeometry(4, 16);
    const floorMat = this.materials[0].clone();
    floorMat.side = THREE.DoubleSide;
    floorMat.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "varying vec3 vStrataPos;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vStrataPos = position;`,
        );
      shader.fragmentShader =
        "varying vec3 vStrataPos;\n" +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float sedimentDep = sin(length(vStrataPos.xy) * 16.0) * 0.035;
          diffuseColor.rgb += vec3(sedimentDep * 0.8, sedimentDep * 0.75, sedimentDep * 0.55);`,
        );
    };
    floorMat.customProgramCacheKey = () => "frontier-strata-floor-v1";
    this.materials.push(floorMat);
    this.floor = new THREE.Mesh(this.floorGeo, floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -RECORD_DEPTH;
    this.group.add(this.floor);
  }
  describe(y) {
    const era = this.eras.reduce((a, b) =>
      Math.abs(b.depth + y) < Math.abs(a.depth + y) ? b : a,
    );
    return `About ${era.yearsAgo} years ago. ${era.event}`;
  }
  update(body, memory, strataHold, time = 0) {
    const read = memory?.strata ?? [];
    for (let i = 0; i < this.eras.length; i++) {
      const mat = this.materials[i];
      const isRead = read.includes(i);
      const isHolding = strataHold?.band === i && strataHold.held > 0;
      if (isHolding) {
        // Active resonance pulse while reading inside the band
        const pulse = Math.sin((strataHold.held / 0.9) * Math.PI) * 0.35;
        mat.emissive.setRGB(
          0.08 + pulse * 0.15,
          0.18 + pulse * 0.22,
          0.16 + pulse * 0.2,
        );
        mat.roughness = 0.65;
      } else if (isRead) {
        // Luminous ancient mineral patina for logged strata
        mat.emissive.setRGB(0.04, 0.11, 0.1);
        mat.roughness = 0.72;
      } else {
        // Unread stone
        mat.emissive.setRGB(0, 0, 0);
        mat.roughness = 1.0;
      }
    }
  }
  dispose() {
    this.geo.dispose();
    this.floorGeo.dispose();
    for (const m of this.materials) m.dispose();
    this.group.removeFromParent();
  }
}
