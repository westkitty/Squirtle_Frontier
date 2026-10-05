import * as THREE from "three";

export class Atmosphere {
  constructor(scene) {
    this.topClear = new THREE.Color("#4a7682");
    this.horizonClear = new THREE.Color("#a3c4b7");
    this.topRain = new THREE.Color("#3c4c54");
    this.horizonRain = new THREE.Color("#728480");
    this.sunColorClear = new THREE.Color("#fff2d6");
    this.sunColorRain = new THREE.Color("#cbd4d0");
    this.sunDirection = new THREE.Vector3(-18, 30, 10).normalize();
    this.topWetland = new THREE.Color("#446b73");
    this.horizonWetland = new THREE.Color("#95b5a2");
    this.topCanyon = new THREE.Color("#3f6675");
    this.horizonCanyon = new THREE.Color("#96a29e");
    this.scratchTop = new THREE.Color();
    this.scratchHorizon = new THREE.Color();
    this.uniforms = {
      top: { value: this.topClear.clone() },
      horizon: { value: this.horizonClear.clone() },
      sunDir: { value: this.sunDirection.clone() },
      sunColor: { value: this.sunColorClear.clone() },
      uTime: { value: 0 },
      uRain: { value: 0 },
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
          gl_FragColor = vec4(mix(horizon, top, t), 1.0);
        }
      `,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    scene.add(this.mesh);
  }

  update(camera, { rain = 0, visible = true, time = 0, regionBias = null } = {}) {
    this.mesh.visible = !!visible;
    if (!this.mesh.visible) return;
    const r = THREE.MathUtils.clamp(Number(rain) || 0, 0, 1);
    this.mesh.position.copy(camera.position);
    this.uniforms.uTime.value = time;
    this.uniforms.uRain.value = r;

    this.scratchTop.copy(this.topClear);
    this.scratchHorizon.copy(this.horizonClear);
    if (regionBias) {
      const w = THREE.MathUtils.clamp(Number(regionBias.wetland) || 0, 0, 1);
      const c = THREE.MathUtils.clamp(Number(regionBias.canyon) || 0, 0, 1);
      if (w > 0) {
        this.scratchTop.lerp(this.topWetland, w * 0.65);
        this.scratchHorizon.lerp(this.horizonWetland, w * 0.75);
      }
      if (c > 0) {
        this.scratchTop.lerp(this.topCanyon, c * 0.55);
        this.scratchHorizon.lerp(this.horizonCanyon, c * 0.65);
      }
    }

    this.uniforms.top.value.copy(this.scratchTop).lerp(this.topRain, r);
    this.uniforms.horizon.value
      .copy(this.scratchHorizon)
      .lerp(this.horizonRain, r);
    this.uniforms.sunColor.value
      .copy(this.sunColorClear)
      .lerp(this.sunColorRain, r);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.removeFromParent();
  }
}
