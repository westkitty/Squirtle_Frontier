import * as THREE from "three";
import { deepHistory } from "../simulation/deep-history.js";
export const recordRegion = {
  sample: () => ({ height: -22, dx: 0, dz: 0 }),
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
      this.materials.push(mat);
      const m = new THREE.Mesh(this.geo, mat);
      m.position.y = -e.depth;
      this.group.add(m);
    }
    this.floorGeo = new THREE.CircleGeometry(4, 16);
    const floorMat = this.materials[0].clone();
    floorMat.side = THREE.DoubleSide;
    this.materials.push(floorMat);
    this.floor = new THREE.Mesh(this.floorGeo, floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -22;
    this.group.add(this.floor);
  }
  describe(y) {
    const era = this.eras.reduce((a, b) =>
      Math.abs(b.depth + y) < Math.abs(a.depth + y) ? b : a,
    );
    return `About ${era.yearsAgo} years ago. ${era.event}`;
  }
  dispose() {
    this.geo.dispose();
    this.floorGeo.dispose();
    for (const m of this.materials) m.dispose();
    this.group.removeFromParent();
  }
}
