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
        varying vec3 vWorldDir;
        varying float vSkyY;
        void main() {
          vWorldDir = normalize(position);
          vSkyY = vWorldDir.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 top;
        uniform vec3 horizon;
        uniform vec3 sunDir;
        uniform vec3 sunColor;
        uniform float uTime;
        uniform float uRain;
        varying vec3 vWorldDir;
        varying float vSkyY;

        void main() {
          float t = smoothstep(-0.25, 0.75, vSkyY);
          vec3 skyBase = mix(horizon, top, t);

          // Atmospheric horizon warm haze band
          float horizonHaze = exp(-max(0.0, vSkyY + 0.12) * 5.0) * (1.0 - uRain * 0.7);
          skyBase = mix(skyBase, horizon * vec3(1.08, 1.04, 0.95), horizonHaze * 0.45);

          // Procedural drifting cloud wisps across the dome
          if (vSkyY > 0.05) {
            float cloudP1 = sin(vWorldDir.x * 3.8 + uTime * 0.035) * cos(vWorldDir.z * 3.8 - uTime * 0.028);
            float cloudP2 = sin(vWorldDir.x * 7.5 - uTime * 0.05) * cos(vWorldDir.z * 7.5 + uTime * 0.04);
            float clouds = smoothstep(0.2, 0.72, cloudP1 + cloudP2 * 0.4) * smoothstep(0.05, 0.4, vSkyY) * (1.0 - uRain * 0.75);
            vec3 cloudTint = mix(vec3(0.92, 0.96, 0.98), vec3(0.58, 0.64, 0.68), uRain);
            skyBase = mix(skyBase, cloudTint, clouds * 0.32);
          }

          // Directional solar disk, atmospheric corona & crepuscular rays
          float sunDot = max(0.0, dot(vWorldDir, sunDir));
          float sunCorona = pow(sunDot, 14.0) * (1.0 - uRain * 0.75);
          float sunDisk = smoothstep(0.9982, 0.9996, sunDot) * (1.0 - uRain * 0.92);
          float rayAngle = atan(vWorldDir.x - sunDir.x, vWorldDir.y - sunDir.y);
          float rayNoise = sin(rayAngle * 12.0 + uTime * 0.08) * 0.5 + 0.5;
          float sunRays = pow(sunDot, 6.0) * rayNoise * 0.22 * (1.0 - uRain * 0.85);

          vec3 finalColor = skyBase + sunColor * (sunCorona * 0.42 + sunRays) + vec3(1.0, 0.98, 0.92) * sunDisk * 1.6;
          gl_FragColor = vec4(finalColor, 1.0);
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
