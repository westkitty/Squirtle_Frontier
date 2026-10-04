import * as THREE from "three";

export class Atmosphere {
  constructor(scene) {
    this.topClear = new THREE.Color("#597f86");
    this.horizonClear = new THREE.Color("#a9c3b6");
    this.topRain = new THREE.Color("#44565e");
    this.horizonRain = new THREE.Color("#788c86");
    this.uniforms = {
      top: { value: this.topClear.clone() },
      horizon: { value: this.horizonClear.clone() },
    };
    this.geometry = new THREE.SphereGeometry(92, 24, 12);
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      vertexShader: `
        varying float vSkyY;
        void main() {
          vSkyY = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 top;
        uniform vec3 horizon;
        varying float vSkyY;
        void main() {
          float t = smoothstep(-0.22, 0.72, vSkyY);
          vec3 color = mix(horizon, top, t);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    scene.add(this.mesh);
  }

  update(camera, { rain = 0, visible = true } = {}) {
    this.mesh.visible = !!visible;
    if (!this.mesh.visible) return;
    const r = THREE.MathUtils.clamp(Number(rain) || 0, 0, 1);
    this.mesh.position.copy(camera.position);
    this.uniforms.top.value.copy(this.topClear).lerp(this.topRain, r);
    this.uniforms.horizon.value
      .copy(this.horizonClear)
      .lerp(this.horizonRain, r);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.removeFromParent();
  }
}
