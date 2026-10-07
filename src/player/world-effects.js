import { channelHeight, CHANNEL_DEPTH } from "../simulation/channel-terrain.js";
import * as THREE from "three";
import { fireSite, traceChannel } from "../simulation/frontier-systems.js";
import { heightAt } from "../worldgen.js";
import { WETLAND } from "./habitat-view.js";
export class WorldEffects {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.geo = new THREE.ConeGeometry(1, 1, 5);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xfca953 });
    this.fire = new THREE.InstancedMesh(this.geo, this.mat, 16);
    this.fire.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.fire);
    this.fire.frustumCulled = false;
    this.smokeMat = new THREE.MeshBasicMaterial({
      color: 0x3d4541,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });
    this.fireSmoke = new THREE.InstancedMesh(this.geo, this.smokeMat, 16);
    this.fireSmoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fireSmoke.frustumCulled = false;
    this.fireSmoke.count = 0;
    this.fireSmoke.visible = false;
    this.group.add(this.fireSmoke);
    this.rainMat = new THREE.MeshBasicMaterial({
      color: 0xb7dce0,
      transparent: true,
      opacity: 0.4,
    });
    this.rain = new THREE.InstancedMesh(this.geo, this.rainMat, 96);
    this.rain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rain.frustumCulled = false;
    this.group.add(this.rain);

    this.jetMat = new THREE.MeshBasicMaterial({
      color: 0x9ee7ff,
      transparent: true,
      opacity: 0.85,
    });
    this.jetMat.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "varying vec3 vJetPos;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vJetPos = position;`,
        );
      shader.fragmentShader =
        "varying vec3 vJetPos;\n" +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float core = clamp(1.0 - length(vJetPos.xz) * 1.5, 0.0, 1.0);
          float froth = sin(vJetPos.y * 22.0) * 0.12;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 1.0, 1.0), core * 0.75 + froth);`,
        );
    };
    this.jetMat.customProgramCacheKey = () => "frontier-jet-stream-v1";

    this.jet = new THREE.InstancedMesh(this.geo, this.jetMat, 24);
    this.jet.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.jet.frustumCulled = false;
    this.jet.count = 0;
    this.jet.visible = false;
    this.group.add(this.jet);

    this.jetImpactMat = new THREE.MeshBasicMaterial({
      color: 0xd7f6ff,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    this.jetImpact = new THREE.InstancedMesh(this.geo, this.jetImpactMat, 12);
    this.jetImpact.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.jetImpact.frustumCulled = false;
    this.jetImpact.count = 0;
    this.jetImpact.visible = false;
    this.group.add(this.jetImpact);

    this.jetWetPatchGeo = new THREE.CircleGeometry(0.26, 12);
    this.jetWetPatchMat = new THREE.MeshBasicMaterial({
      color: 0x4c6257,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.jetWetPatch = new THREE.Mesh(this.jetWetPatchGeo, this.jetWetPatchMat);
    this.jetWetPatch.rotation.x = -Math.PI / 2;
    this.jetWetPatch.visible = false;
    this.jetWetPatchUntil = -Infinity;
    this.group.add(this.jetWetPatch);

    this.wakeMat = new THREE.MeshBasicMaterial({
      color: 0x90e6f7,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });
    this.wakeMat.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "varying vec3 vWakePos;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vWakePos = position;`,
        );
      shader.fragmentShader =
        "varying vec3 vWakePos;\n" +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float wakeDist = length(vWakePos.xy);
          float ring = sin(wakeDist * 20.0) * 0.5 + 0.5;
          float edgeFade = smoothstep(1.0, 0.25, wakeDist);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.94, 0.98, 1.0), ring * 0.42);
          diffuseColor.a *= edgeFade;`,
        );
    };
    this.wakeMat.customProgramCacheKey = () => "frontier-wake-ripple-v1";

    this.wake = new THREE.InstancedMesh(this.geo, this.wakeMat, 16);
    this.wake.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wake.frustumCulled = false;
    this.wake.count = 0;
    this.wake.visible = false;
    this.group.add(this.wake);

    this.splashMat = new THREE.MeshBasicMaterial({
      color: 0xc6f3ff,
      transparent: true,
      opacity: 0.75,
    });
    this.splashMat.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "varying vec3 vSplashPos;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vSplashPos = position;`,
        );
      shader.fragmentShader =
        "varying vec3 vSplashPos;\n" +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float dropletGlint = pow(clamp(1.0 - length(vSplashPos), 0.0, 1.0), 2.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 1.0, 1.0), dropletGlint * 0.85);`,
        );
    };
    this.splashMat.customProgramCacheKey = () => "frontier-splash-glint-v1";

    this.splash = new THREE.InstancedMesh(this.geo, this.splashMat, 20);
    this.splash.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.splash.frustumCulled = false;
    this.splash.count = 0;
    this.splash.visible = false;
    this.group.add(this.splash);

    this.dustMat = new THREE.MeshBasicMaterial({
      color: 0xb9aa8a,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    this.dustMat.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "varying vec3 vDustPos;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vDustPos = position;`,
        );
      shader.fragmentShader =
        "varying vec3 vDustPos;\n" +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float dDist = length(vDustPos);
          float puff = smoothstep(0.9, 0.15, dDist);
          float swirl = sin(vDustPos.x * 14.0 + vDustPos.y * 16.0) * 0.08;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.74, 0.58), swirl + 0.5);
          diffuseColor.a *= puff;`,
        );
    };
    this.dustMat.customProgramCacheKey = () => "frontier-dust-puff-v1";

    this.slideDust = new THREE.InstancedMesh(this.geo, this.dustMat, 18);
    this.slideDust.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.slideDust.frustumCulled = false;
    this.slideDust.count = 0;
    this.slideDust.visible = false;
    this.group.add(this.slideDust);

    this.foamMat = new THREE.MeshBasicMaterial({
      color: 0xebf7fa,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    this.foamMat.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "varying vec3 vFoamPos;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vFoamPos = position;`,
        );
      shader.fragmentShader =
        "varying vec3 vFoamPos;\n" +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float bubble = sin(vFoamPos.x * 24.0) * cos(vFoamPos.y * 20.0 + vFoamPos.z * 18.0);
          diffuseColor.rgb += vec3(0.08, 0.12, 0.14) * max(0.0, bubble);
          float aerate = smoothstep(0.1, 0.8, 1.0 - length(vFoamPos.xy));
          diffuseColor.a *= aerate;`,
        );
    };
    this.foamMat.customProgramCacheKey = () => "frontier-stream-foam-v1";

    this.streamFoam = new THREE.InstancedMesh(this.geo, this.foamMat, 16);
    this.streamFoam.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.streamFoam.frustumCulled = false;
    this.streamFoam.count = 0;
    this.streamFoam.visible = false;
    this.group.add(this.streamFoam);

    this.mistMat = new THREE.MeshBasicMaterial({
      color: 0xb8ccc3,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    this.wetlandMist = new THREE.InstancedMesh(this.geo, this.mistMat, 14);
    this.wetlandMist.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wetlandMist.frustumCulled = false;
    this.wetlandMist.count = 0;
    this.wetlandMist.visible = false;
    this.group.add(this.wetlandMist);

    this.rainRippleMat = new THREE.MeshBasicMaterial({
      color: 0xc8edf4,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.rainRipples = new THREE.InstancedMesh(
      this.geo,
      this.rainRippleMat,
      18,
    );
    this.rainRipples.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rainRipples.frustumCulled = false;
    this.rainRipples.count = 0;
    this.rainRipples.visible = false;
    this.group.add(this.rainRipples);

    this.underwaterMat = new THREE.MeshBasicMaterial({
      color: 0xb8d0c7,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    this.underwaterMat.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "varying vec3 vMotePos;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vMotePos = position;`,
        );
      shader.fragmentShader =
        "varying vec3 vMotePos;\n" +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float moteCore = clamp(1.0 - length(vMotePos) * 1.8, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 1.0, 0.95), moteCore * 0.6);
          diffuseColor.a *= (moteCore * 0.8 + 0.2);`,
        );
    };
    this.underwaterMat.customProgramCacheKey = () => "frontier-mote-shimmer-v1";

    this.underwaterMotes = new THREE.InstancedMesh(
      this.geo,
      this.underwaterMat,
      32,
    );
    this.underwaterMotes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.underwaterMotes.frustumCulled = false;
    this.underwaterMotes.count = 0;
    this.underwaterMotes.visible = false;
    this.group.add(this.underwaterMotes);

    this.route = traceChannel();
    this.fireSites = Array.from({ length: 16 }, (_, i) => {
      const p = fireSite(i);
      return { x: p.x, z: p.z, ground: heightAt(p.x, p.z) };
    });
    this.rainGround = new Float32Array(96);
    this.rainAnchorX = Infinity;
    this.rainAnchorZ = Infinity;
    this.rainGroundCount = 0;
    this.rainGroundAt = -Infinity;
    this.mistGround = new Float32Array(14);
    this.mistGroundAt = -Infinity;
    this.mistGroundCount = 0;
    this.terrainSamples = 16;
    this.rainGroundRefreshes = 0;
    this.mistGroundRefreshes = 0;
    this.foamRebuilds = 0;
    this.foamPathX = new Float32Array(128);
    this.foamPathY = new Float32Array(128);
    this.foamPathZ = new Float32Array(128);
    this.foamPathTX = new Float32Array(128);
    this.foamPathTZ = new Float32Array(128);
    this.channelStage = -1;
    this.channelGeo = new THREE.BufferGeometry();
    this.channelGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array((this.route.length - 1) * 18),
        3,
      ),
    );
    this.channelMat = new THREE.MeshStandardMaterial({
      color: 0x4a7e70,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });
    this.channel = new THREE.Mesh(this.channelGeo, this.channelMat);
    this.group.add(this.channel);
    this.channel.frustumCulled = false;
    for (const mesh of [
      this.fire,
      this.fireSmoke,
      this.rain,
      this.jet,
      this.jetImpact,
      this.wake,
      this.splash,
      this.slideDust,
      this.streamFoam,
      this.wetlandMist,
      this.rainRipples,
      this.underwaterMotes,
      this.channel,
    ]) {
      mesh.updateMatrix();
      mesh.matrixAutoUpdate = false;
    }
    this.dummy = new THREE.Object3D();
  }
  refreshRainGround(body, count, elapsed) {
    const moved =
        Math.hypot(body.x - this.rainAnchorX, body.z - this.rainAnchorZ) > 0.75,
      stale = elapsed - this.rainGroundAt >= 0.25,
      grew = count > this.rainGroundCount;
    if (!moved && !stale && !grew) return;
    this.rainAnchorX = body.x;
    this.rainAnchorZ = body.z;
    this.rainGroundAt = elapsed;
    this.rainGroundCount = count;
    this.rainGroundRefreshes++;
    for (let i = 0; i < count; i++) {
      const x = body.x + Math.sin(i * 3.3) * 8,
        z = body.z + Math.cos(i * 5.7) * 8;
      this.rainGround[i] = heightAt(x, z);
      this.terrainSamples++;
    }
  }
  rebuildChannel(stage) {
    this.channelStage = stage;
    const positions = this.channelGeo.attributes.position;
    let index = 0;
    for (let i = 0; i < this.route.length - 1; i++) {
      const a = this.route[i],
        b = this.route[i + 1],
        dx = b.x - a.x,
        dz = b.z - a.z,
        len = Math.hypot(dx, dz) || 1,
        w = 0.045 + stage * 0.022,
        nx = dz / len,
        nz = -dx / len,
        ay =
          channelHeight(a.x, a.z, stage) +
          CHANNEL_DEPTH[stage] * 0.55 +
          0.015,
        by =
          channelHeight(b.x, b.z, stage) +
          CHANNEL_DEPTH[stage] * 0.55 +
          0.015,
        al = [a.x - nx * w, ay, a.z - nz * w],
        ar = [a.x + nx * w, ay, a.z + nz * w],
        bl = [b.x - nx * w, by, b.z - nz * w],
        br = [b.x + nx * w, by, b.z + nz * w];
      for (const v of [al, bl, ar, ar, bl, br])
        positions.setXYZ(index++, v[0], v[1], v[2]);
    }
    positions.needsUpdate = true;
    this.channelGeo.computeVertexNormals();
    this.channelGeo.computeBoundingSphere();

    const last = this.foamPathX.length - 1;
    for (let i = 0; i <= last; i++) {
      const progress = i / last,
        floatIdx = progress * (this.route.length - 1),
        routeIndex = Math.min(
          this.route.length - 2,
          Math.floor(floatIdx),
        ),
        fract = floatIdx - routeIndex,
        p0 = this.route[routeIndex],
        p1 = this.route[routeIndex + 1],
        dx = p1.x - p0.x,
        dz = p1.z - p0.z,
        len = Math.hypot(dx, dz) || 1,
        px = p0.x + dx * fract,
        pz = p0.z + dz * fract;
      this.foamPathX[i] = px;
      this.foamPathZ[i] = pz;
      this.foamPathY[i] =
        channelHeight(px, pz, stage) +
        CHANNEL_DEPTH[stage] * 0.55 +
        0.022;
      this.foamPathTX[i] = dx / len;
      this.foamPathTZ[i] = dz / len;
    }
    this.foamRebuilds++;
  }
  update(state, body, options = {}) {
    const effectScale = Math.max(
      0.2,
      Math.min(
        1,
        Number(options.effectScale ?? options.renderScale) || 1,
      ),
    );
    this.rain.count = Math.floor(
      state.frontier.weather.rain * 96 * effectScale,
    );
    if (this.rain.count > 0)
      this.refreshRainGround(body, this.rain.count, state.elapsed);
    for (let i = 0; i < this.rain.count; i++) {
      const x = body.x + Math.sin(i * 3.3) * 8,
        z = body.z + Math.cos(i * 5.7) * 8;
      this.dummy.position.set(
        x,
        this.rainGround[i] +
          ((((i * 0.37 - state.elapsed * 5) % 5) + 5) % 5),
        z,
      );
      this.dummy.rotation.set(0, 0, -0.18);
      this.dummy.scale.set(0.008, 0.3, 0.008);
      this.dummy.updateMatrix();
      this.rain.setMatrixAt(i, this.dummy.matrix);
    }
    if (this.rain.count > 0) this.rain.instanceMatrix.needsUpdate = true;
    let count = 0;
    for (let i = 0; i < 16; i++) {
      const p = this.fireSites[i],
        h = state.frontier.heat[i];
      if (h < 0.02 || Math.hypot(body.x - p.x, body.z - p.z) > 35) continue;
      const flicker =
          0.9 + Math.sin(state.elapsed * 13 + i * 2.17) * 0.1,
        lean = Math.sin(state.elapsed * 7.5 + i * 1.31) * 0.11;
      this.dummy.position.set(
        p.x + lean * 0.18,
        p.ground + (h * flicker) / 2,
        p.z - lean * 0.12,
      );
      this.dummy.rotation.set(0, i * 0.73, lean);
      this.dummy.scale.set(
        0.42 + flicker * 0.08,
        h * 1.5 * flicker,
        0.42 + (1.8 - flicker) * 0.08,
      );
      this.dummy.updateMatrix();
      this.fire.setMatrixAt(count, this.dummy.matrix);
      this.dummy.position.y += h * 1.05 + 0.35;
      this.dummy.position.x += Math.sin(state.elapsed * 0.7 + i) * 0.12;
      this.dummy.position.z += Math.cos(state.elapsed * 0.6 + i) * 0.09;
      this.dummy.rotation.set(0, state.elapsed * 0.25 + i, lean * 0.25);
      const smokeScale = 0.22 + h * 0.2;
      this.dummy.scale.set(smokeScale, 0.3 + h * 0.55, smokeScale);
      this.dummy.updateMatrix();
      this.fireSmoke.setMatrixAt(count, this.dummy.matrix);
      count++;
    }
    this.fire.count = count;
    this.fire.visible = count > 0;
    this.fireSmoke.count =
      count > 0 ? Math.max(1, Math.round(count * effectScale)) : 0;
    this.fireSmoke.visible = this.fireSmoke.count > 0;
    this.rain.visible = this.rain.count > 0;
    this.channel.visible = state.frontier.stage > 0;
    if (count > 0) {
      this.fire.instanceMatrix.needsUpdate = true;
      this.fireSmoke.instanceMatrix.needsUpdate = true;
    }
    this.channelMat.color.set(state.frontier.stage < 2 ? 0x71664a : 0x428d85);
    this.channelMat.roughness = state.frontier.stage < 2 ? 0.88 : 0.22;
    if (this.channelStage !== state.frontier.stage)
      this.rebuildChannel(state.frontier.stage);

    // 1. Water Hose stream: camera intention drives a continuous pressurized stream.
    if (body.hoseActive) {
      this.jet.visible = true;
      this.jet.count = Math.max(8, Math.round(24 * effectScale));
      const aimLength = Math.hypot(body.hoseAimX, body.hoseAimY, body.hoseAimZ),
        dirX = aimLength > 0.001 ? body.hoseAimX / aimLength : Math.sin(body.yaw),
        dirY = aimLength > 0.001 ? body.hoseAimY / aimLength : 0,
        dirZ = aimLength > 0.001 ? body.hoseAimZ / aimLength : Math.cos(body.yaw),
        snoutX = body.x + Math.sin(body.yaw) * 0.28,
        snoutY = body.y + 0.22,
        snoutZ = body.z + Math.cos(body.yaw) * 0.28;
      for (let i = 0; i < this.jet.count; i++) {
        const dist = (i / Math.max(1, this.jet.count - 1)) * 2.8,
          spread = dist * 0.1,
          turbX = Math.sin(i * 3.7 + state.elapsed * 25) * spread,
          turbZ = Math.cos(i * 2.9 + state.elapsed * 25) * spread,
          turbY = (Math.sin(i * 5.1 + state.elapsed * 30) - 0.2) * spread * 0.5;
        this.dummy.position.set(
          snoutX + dirX * dist + turbX,
          snoutY + dirY * dist + turbY,
          snoutZ + dirZ * dist + turbZ,
        );
        this.dummy.rotation.set(0, body.yaw, 0);
        this.dummy.scale.set(
          0.035 * (1 + dist * 0.35),
          0.12 * (1 + dist * 0.6),
          0.035 * (1 + dist * 0.35),
        );
        this.dummy.updateMatrix();
        this.jet.setMatrixAt(i, this.dummy.matrix);
      }
      this.jet.instanceMatrix.needsUpdate = true;
    } else {
      this.jet.count = 0;
      this.jet.visible = false;
    }

    // Unified Hose-hit feedback: one world-space contact event feeds splash/steam.
    const jetHit = options?.jetHit;
    if (jetHit?.active) {
      const intensity = THREE.MathUtils.clamp(Number(jetHit.intensity) || 0, 0, 1),
        fireHit = jetHit.kind === "fire",
        ashHit = jetHit.kind === "ash",
        countBase = 5 + Math.round(intensity * 7);
      this.jetImpact.visible = true;
      this.jetImpact.count = Math.max(4, Math.round(countBase * effectScale));
      this.jetImpactMat.opacity = 0.42 + intensity * 0.42;
      this.jetImpactMat.color.set(
        fireHit ? 0xf0fbff : ashHit ? 0xbfd9d4 : jetHit.kind === "mud" ? 0x88b4ad : 0xc7eff8,
      );
      for (let i = 0; i < this.jetImpact.count; i++) {
        const phase =
            (((state.elapsed * (fireHit ? 5.6 : 4.2) +
              i / this.jetImpact.count +
              (jetHit.serial % 7) * 0.07) %
              1) +
              1) %
            1,
          angle = i * 2.39996 + jetHit.serial * 0.31,
          radius = (0.035 + phase * 0.2) * (0.65 + intensity * 0.6),
          rise = phase * (fireHit ? 0.48 : 0.24),
          size = (0.025 + (1 - phase) * 0.045) * (0.7 + intensity * 0.45);
        this.dummy.position.set(
          jetHit.x + Math.cos(angle) * radius,
          jetHit.y + rise,
          jetHit.z + Math.sin(angle) * radius,
        );
        this.dummy.rotation.set(angle * 0.3, angle, 0);
        this.dummy.scale.set(size, size * (fireHit ? 2.4 : 1.5), size);
        this.dummy.updateMatrix();
        this.jetImpact.setMatrixAt(i, this.dummy.matrix);
      }
      this.jetImpact.instanceMatrix.needsUpdate = true;
    } else {
      this.jetImpact.count = 0;
      this.jetImpact.visible = false;
    }

    // Mud darkens where the Hose lands; one reusable patch fades after contact.
    if (jetHit?.active && jetHit.kind === "mud") {
      this.jetWetPatch.position.set(jetHit.x, jetHit.y + 0.012, jetHit.z);
      this.jetWetPatchUntil = state.elapsed + 1.2;
    }
    const wetPatchLife = this.jetWetPatchUntil - state.elapsed;
    if (wetPatchLife > 0) {
      this.jetWetPatch.visible = true;
      const life = THREE.MathUtils.clamp(wetPatchLife / 1.2, 0, 1);
      this.jetWetPatchMat.opacity = 0.12 + life * 0.24;
      this.jetWetPatch.scale.setScalar(0.82 + (1 - life) * 0.28);
    } else {
      this.jetWetPatch.visible = false;
    }

    // 2. Aquatic surface wake: expanding concentric ripples during swimming/sliding in water
    const water = options?.water;
    const inWater = !!water && body.y <= water.level + 0.15;
    const speed = Math.hypot(body.vx, body.vz);
    if (inWater && speed > 0.25 && body.jetTime <= 0 && !body.hoseActive) {
      this.wake.visible = true;
      const wakeBase = Math.max(
        4,
        Math.min(16, Math.round(4 + Math.min(speed, 4) * 3)),
      );
      this.wake.count = Math.max(3, Math.round(wakeBase * effectScale));
      const surfY = water.level + 0.015,
        spread = 0.7 + Math.min(speed, 4) * 0.18;
      for (let i = 0; i < this.wake.count; i++) {
        const phase =
            (((state.elapsed * 1.5 + i * (1 / this.wake.count)) % 1) + 1) % 1,
          r = 0.18 + phase * spread,
          trailDist = phase * Math.min(speed, 4.0) * 0.42,
          rx = body.x - (speed > 0.01 ? (body.vx / speed) * trailDist : 0),
          rz = body.z - (speed > 0.01 ? (body.vz / speed) * trailDist : 0);
        this.dummy.position.set(rx, surfY, rz);
        this.dummy.rotation.set(-Math.PI / 2, 0, 0);
        this.dummy.scale.set(r, 0.008, r);
        this.dummy.updateMatrix();
        this.wake.setMatrixAt(i, this.dummy.matrix);
      }
      this.wake.instanceMatrix.needsUpdate = true;
    } else {
      this.wake.count = 0;
      this.wake.visible = false;
    }

    // Rain should meet the water instead of disappearing at the surface. These
    // presentation ripples reuse the shared effect geometry and never alter hydrology.
    const rainStrength = THREE.MathUtils.clamp(
      Number(state.frontier.weather.rain) || 0,
      0,
      1,
    );
    if (water && rainStrength > 0.08) {
      this.rainRipples.visible = true;
      this.rainRipples.count = Math.max(
        3,
        Math.round(18 * rainStrength * effectScale),
      );
      this.rainRippleMat.opacity = 0.18 + rainStrength * 0.3;
      for (let i = 0; i < this.rainRipples.count; i++) {
        const phase =
            (((state.elapsed * 1.9 + i * 0.173) % 1) + 1) % 1,
          angle = i * 2.39996,
          radius = 0.5 + (i % 6) * 0.62,
          x = body.x + Math.cos(angle) * radius,
          z = body.z + Math.sin(angle) * radius,
          size = 0.05 + phase * 0.16;
        this.dummy.position.set(x, water.level + 0.018, z);
        this.dummy.rotation.set(-Math.PI / 2, 0, angle);
        this.dummy.scale.set(size, 0.006, size);
        this.dummy.updateMatrix();
        this.rainRipples.setMatrixAt(i, this.dummy.matrix);
      }
      this.rainRipples.instanceMatrix.needsUpdate = true;
    } else {
      this.rainRipples.count = 0;
      this.rainRipples.visible = false;
    }

    // Diving reveals suspended material already represented by the watershed.
    const wetland = state.watershed?.nodes?.[2] || {},
      sediment = THREE.MathUtils.clamp(Number(wetland.sediment) || 0, 0, 1),
      contamination = THREE.MathUtils.clamp(
        Number(wetland.contamination) || 0,
        0,
        1,
      ),
      particulate = THREE.MathUtils.clamp(
        0.22 + sediment * 0.58 + contamination * 0.35,
        0.18,
        1,
      );
    if (water && body.mode === "dive") {
      this.underwaterMotes.visible = true;
      this.underwaterMotes.count = Math.max(
        5,
        Math.round(32 * particulate * effectScale),
      );
      this.underwaterMat.opacity = 0.08 + particulate * 0.22;
      this.underwaterMat.color.setHSL(
        0.45 - sediment * 0.08,
        0.18 + contamination * 0.08,
        0.7 - sediment * 0.18,
      );
      for (let i = 0; i < this.underwaterMotes.count; i++) {
        const angle = i * 2.39996 + state.elapsed * 0.08,
          radius = 0.45 + (i % 8) * 0.42,
          drift = Math.sin(state.elapsed * 0.35 + i * 1.31) * 0.22,
          y = Math.min(
            water.level - 0.08,
            body.y - 0.65 + ((i * 0.41 + state.elapsed * 0.07) % 1) * 1.7,
          ),
          size = 0.014 + (i % 4) * 0.005;
        this.dummy.position.set(
          body.x + Math.cos(angle) * (radius + drift),
          y,
          body.z + Math.sin(angle) * (radius + drift),
        );
        this.dummy.rotation.set(0, angle, 0);
        this.dummy.scale.set(size, size * 1.6, size);
        this.dummy.updateMatrix();
        this.underwaterMotes.setMatrixAt(i, this.dummy.matrix);
      }
      this.underwaterMotes.instanceMatrix.needsUpdate = true;
    } else {
      this.underwaterMotes.count = 0;
      this.underwaterMotes.visible = false;
    }

    // 3. Splash / water-exit shake droplets: radial scatter during shake or water impact
    const isShaking = options?.isShaking ?? false;
    const splashActive = isShaking || (inWater && body.impact > 0.06);
    if (splashActive) {
      this.splash.visible = true;
      const strength = isShaking
        ? 1
        : Math.max(0.3, Math.min(1, body.impact / 0.2));
      const splashBase = Math.max(6, Math.round(20 * strength));
      this.splash.count = Math.max(4, Math.round(splashBase * effectScale));
      for (let i = 0; i < this.splash.count; i++) {
        const theta =
            (i / this.splash.count) * Math.PI * 2 + state.elapsed * 12,
          arcDist =
            0.25 +
            ((((i * 0.31 + state.elapsed * 4) % 1) + 1) % 1) *
              (0.55 + strength * 0.65),
          dropletY = body.y + 0.2 + Math.sin(arcDist * Math.PI) * 0.35;
        this.dummy.position.set(
          body.x + Math.cos(theta) * arcDist,
          dropletY,
          body.z + Math.sin(theta) * arcDist,
        );
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.set(0.025, 0.06, 0.025);
        this.dummy.updateMatrix();
        this.splash.setMatrixAt(i, this.dummy.matrix);
      }
      this.splash.instanceMatrix.needsUpdate = true;
    } else {
      this.splash.count = 0;
      this.splash.visible = false;
    }

    // 4. Dry shell-slide dust: body-specific contact feedback, never emitted in water.
    const drySlide = !inWater && body.mode === "slide" && speed > 0.8;
    if (drySlide) {
      this.slideDust.visible = true;
      const dustBase = Math.min(18, Math.max(4, Math.round(speed * 3.2)));
      this.slideDust.count = Math.max(3, Math.round(dustBase * effectScale));
      const dirX = speed > 0.01 ? body.vx / speed : Math.sin(body.yaw),
        dirZ = speed > 0.01 ? body.vz / speed : Math.cos(body.yaw),
        dustStartY = heightAt(body.x, body.z),
        dustEndY = heightAt(body.x - dirX * 1.33, body.z - dirZ * 1.33);
      this.terrainSamples += 2;
      for (let i = 0; i < this.slideDust.count; i++) {
        const phase =
            (((state.elapsed * 2.1 + i / this.slideDust.count) % 1) + 1) % 1,
          side = Math.sin(i * 5.31) * 0.22 * phase,
          behind = 0.18 + phase * 1.15,
          groundY = THREE.MathUtils.lerp(dustStartY, dustEndY, phase);
        this.dummy.position.set(
          body.x - dirX * behind - dirZ * side,
          groundY + 0.03 + phase * 0.18,
          body.z - dirZ * behind + dirX * side,
        );
        const size = 0.06 + phase * 0.1;
        this.dummy.rotation.set(0, i * 1.7, 0);
        this.dummy.scale.set(size * 1.5, size * 0.55, size * 1.5);
        this.dummy.updateMatrix();
        this.slideDust.setMatrixAt(i, this.dummy.matrix);
      }
      this.slideDust.instanceMatrix.needsUpdate = true;
    } else {
      this.slideDust.count = 0;
      this.slideDust.visible = false;
    }

    // 5. Saturated wetland mist. It reuses the shared low-poly effect geometry,
    // so atmosphere polish does not widen the renderer's geometry budget.
    const wetlandWetness = THREE.MathUtils.clamp(
        Number(state.watershed?.nodes?.[2]?.wetness) || 0,
        0,
        1,
      ),
      wetlandDistance = Math.hypot(body.x - WETLAND.x, body.z - WETLAND.z),
      mistStrength =
        wetlandDistance < 30 && wetlandWetness > 0.52
          ? (wetlandWetness - 0.52) / 0.48
          : 0,
      mistBase = Math.round(14 * mistStrength * effectScale);
    this.wetlandMist.count = mistBase;
    this.wetlandMist.visible = mistBase > 0;
    if (
      mistBase > 0 &&
      (state.elapsed - this.mistGroundAt >= 0.5 ||
        mistBase > this.mistGroundCount)
    ) {
      this.mistGroundAt = state.elapsed;
      this.mistGroundCount = mistBase;
      this.mistGroundRefreshes++;
      for (let i = 0; i < mistBase; i++) {
        const angle = i * 2.39996 + state.elapsed * 0.025,
          radius = 1.4 + (i % 5) * 0.92,
          drift = Math.sin(state.elapsed * 0.22 + i * 1.71) * 0.28,
          x = WETLAND.x + Math.cos(angle) * (radius + drift),
          z = WETLAND.z + Math.sin(angle) * (radius + drift);
        this.mistGround[i] = heightAt(x, z);
        this.terrainSamples++;
      }
    }
    this.mistMat.opacity =
      0.06 +
      mistStrength * 0.1 * (1 - state.frontier.weather.rain * 0.45);
    for (let i = 0; i < this.wetlandMist.count; i++) {
      const angle = i * 2.39996 + state.elapsed * 0.025,
        radius = 1.4 + (i % 5) * 0.92,
        drift = Math.sin(state.elapsed * 0.22 + i * 1.71) * 0.28,
        x = WETLAND.x + Math.cos(angle) * (radius + drift),
        z = WETLAND.z + Math.sin(angle) * (radius + drift),
        y = this.mistGround[i] + 0.16 + (i % 4) * 0.07;
      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(Math.PI / 2, angle, 0);
      this.dummy.scale.set(
        0.7 + (i % 3) * 0.35,
        0.08 + (i % 2) * 0.03,
        0.45 + ((i + 1) % 3) * 0.27,
      );
      this.dummy.updateMatrix();
      this.wetlandMist.setMatrixAt(i, this.dummy.matrix);
    }
    if (this.wetlandMist.count > 0)
      this.wetlandMist.instanceMatrix.needsUpdate = true;

    // 6. Stream foam rapids: churning white water along active flowing channel
    if (state.frontier.stage >= 2 && this.route.length > 1) {
      const channelFlow = Math.max(
        0,
        Math.min(1, Number(options.channelFlow ?? 1)),
      );
      const foamBase =
        channelFlow > 0.04 ? Math.max(4, Math.round(16 * channelFlow)) : 0;
      this.streamFoam.count =
        foamBase > 0 ? Math.max(3, Math.round(foamBase * effectScale)) : 0;
      this.streamFoam.visible = this.streamFoam.count > 0;
      for (let i = 0; i < this.streamFoam.count; i++) {
        const progress =
            (((i / this.streamFoam.count + state.elapsed * 0.35) % 1) + 1) %
            1,
          sample = progress * (this.foamPathX.length - 1),
          a = Math.floor(sample),
          b = Math.min(this.foamPathX.length - 1, a + 1),
          t = sample - a,
          tx = THREE.MathUtils.lerp(this.foamPathTX[a], this.foamPathTX[b], t),
          tz = THREE.MathUtils.lerp(this.foamPathTZ[a], this.foamPathTZ[b], t),
          wobble = Math.sin(state.elapsed * 5.5 + i * 2.1) * 0.035,
          px =
            THREE.MathUtils.lerp(this.foamPathX[a], this.foamPathX[b], t) -
            tz * wobble,
          pz =
            THREE.MathUtils.lerp(this.foamPathZ[a], this.foamPathZ[b], t) +
            tx * wobble,
          py = THREE.MathUtils.lerp(
            this.foamPathY[a],
            this.foamPathY[b],
            t,
          ),
          s = 0.032 + Math.sin(i * 3.7 + state.elapsed * 4) * 0.01;
        this.dummy.position.set(px, py, pz);
        this.dummy.scale.set(s * 1.6, s * 0.5, s * 1.6);
        this.dummy.rotation.set(0, state.elapsed * 2.8 + i, 0);
        this.dummy.updateMatrix();
        this.streamFoam.setMatrixAt(i, this.dummy.matrix);
      }
      this.streamFoam.instanceMatrix.needsUpdate = true;
    } else {
      this.streamFoam.count = 0;
      this.streamFoam.visible = false;
    }
  }

  stats() {
    return {
      rain: this.rain.count,
      fire: this.fire.count,
      smoke: this.fireSmoke.count,
      dust: this.slideDust.count,
      mist: this.wetlandMist.count,
      rainRipples: this.rainRipples.count,
      underwaterMotes: this.underwaterMotes.count,
      jet: this.jet.count,
      jetHit: this.jetImpact.count,
      wetPatch: this.jetWetPatch.visible ? 1 : 0,
      wake: this.wake.count,
      splash: this.splash.count,
      foam: this.streamFoam.count,
      terrainSamples: this.terrainSamples,
      rainGroundRefreshes: this.rainGroundRefreshes,
      mistGroundRefreshes: this.mistGroundRefreshes,
      foamRebuilds: this.foamRebuilds,
    };
  }

  dispose() {
    this.jet.dispose();
    this.jetMat.dispose();
    this.jetImpact.dispose();
    this.jetImpactMat.dispose();
    this.jetWetPatchGeo.dispose();
    this.jetWetPatchMat.dispose();
    this.wake.dispose();
    this.wakeMat.dispose();
    this.splash.dispose();
    this.splashMat.dispose();
    this.slideDust.dispose();
    this.dustMat.dispose();
    this.fireSmoke.dispose();
    this.smokeMat.dispose();
    this.streamFoam.dispose();
    this.foamMat.dispose();
    this.wetlandMist.dispose();
    this.mistMat.dispose();
    this.rainRipples.dispose();
    this.rainRippleMat.dispose();
    this.underwaterMotes.dispose();
    this.underwaterMat.dispose();

    this.rain.dispose();
    this.rainMat.dispose();
    this.fire.dispose();

    this.geo.dispose();
    this.mat.dispose();
    this.channelGeo.dispose();
    this.channelMat.dispose();
    this.group.removeFromParent();
  }
}
