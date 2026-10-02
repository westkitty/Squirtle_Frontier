import { CHANNEL_BOUNDS } from "./simulation/channel-terrain.js";
// Streaming terrain chunks with LOD + the shared "ground memory" texture
// (burn scars, trails, lushness, development) that every surface samples.
import * as THREE from "three";
import { WORLD, heightAt } from "./worldgen.js";
import { clamp, fbm2, valueNoise2 } from "./rng.js";

export const shared = {
  uTime: { value: 0 },
  uWind: { value: new THREE.Vector2(0.7, 0.4) },
  uWindStrength: { value: 0.5 },
  uGround: { value: null },
  uWorldHalf: { value: WORLD.half },
  uSnow: { value: 0 },
  uWet: { value: 0 },
};

export function makeGroundTexture(state) {
  const tex = new THREE.DataTexture(
    state.ground,
    WORLD.stateRes,
    WORLD.stateRes,
    THREE.RGBAFormat,
  );
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  shared.uGround.value = tex;
  return tex;
}

const GROUND_CHUNK_VERT = /* glsl */ `
  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;

const GROUND_FRAG_HEAD = /* glsl */ `
  uniform sampler2D uGround;
  uniform float uWorldHalf;
  uniform float uWet;
  uniform float uSnow;
  varying vec3 vWPos;
`;

const GROUND_FRAG_BODY = /* glsl */ `
  vec2 gUv = (vWPos.xz + uWorldHalf) / (uWorldHalf * 2.0);
  vec4 gs = texture2D(uGround, gUv);
  float burn = gs.r, trail = gs.g, lush = gs.b, dev = gs.a;
  vec3 col = diffuseColor.rgb;
  col = mix(col, col * vec3(1.06, 1.12, 0.92), lush * 0.5);
  col = mix(col, vec3(0.33, 0.27, 0.20), clamp(trail * 1.15, 0.0, 0.88));
  col = mix(col, vec3(0.055, 0.048, 0.05), clamp(burn * 1.25, 0.0, 0.94));
  col = mix(col, vec3(0.42, 0.36, 0.28), dev * 0.55);
  col = mix(col, col * 0.72, uWet * 0.55);
  float snowMask = smoothstep(0.55, 1.0, uSnow) * smoothstep(60.0, 120.0, vWPos.y) * (1.0 - burn);
  col = mix(col, vec3(0.92, 0.94, 0.99), snowMask * 0.85);
  diffuseColor.rgb = col;
`;

export function applyGroundShader(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGround = shared.uGround;
    sh.uniforms.uWorldHalf = shared.uWorldHalf;
    sh.uniforms.uWet = shared.uWet;
    sh.uniforms.uSnow = shared.uSnow;
    sh.vertexShader =
      "varying vec3 vWPos;\n" +
      sh.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n" + GROUND_CHUNK_VERT,
      );
    sh.fragmentShader =
      GROUND_FRAG_HEAD +
      sh.fragmentShader.replace(
        "#include <color_fragment>",
        "#include <color_fragment>\n" + GROUND_FRAG_BODY,
      );
  };
  mat.customProgramCacheKey = () => "groundshader";
  return mat;
}

// --------------------------------------------------------------------------
const cWater = new THREE.Color(0x3a5c52);
const cSand = new THREE.Color(0x9a8a63);
const cGrass = new THREE.Color(0x5f7a3c);
const cGrassDry = new THREE.Color(0x8a8c4c);
const cForest = new THREE.Color(0x3f5c30);
const cHigh = new THREE.Color(0x6a6a4e);
const cRock = new THREE.Color(0x6e6b66);
const cSnow = new THREE.Color(0xe9eef5);
const cMarsh = new THREE.Color(0x4d5c34);
const tmpC = new THREE.Color();

function colorFor(h, slope, m, out) {
  if (h < 0.4) out.copy(cWater).lerp(cSand, clamp((h + 3) / 3.4, 0, 1));
  else if (h < 2.4)
    out
      .copy(cSand)
      .lerp(m > 0.6 ? cMarsh : cGrass, clamp((h - 0.4) / 2.0, 0, 1));
  else if (h < 62)
    out
      .copy(cGrassDry)
      .lerp(cGrass, clamp(m * 1.5, 0, 1))
      .lerp(cForest, clamp((m - 0.45) * 1.6, 0, 1));
  else if (h < 100) out.copy(cGrass).lerp(cHigh, clamp((h - 62) / 38, 0, 1));
  else if (h < 148) out.copy(cHigh).lerp(cRock, clamp((h - 100) / 48, 0, 1));
  else out.copy(cRock).lerp(cSnow, clamp((h - 148) / 30, 0, 1));
  if (slope > 0.32) out.lerp(cRock, clamp((slope - 0.32) * 2.2, 0, 0.9));
  return out;
}

// Distance rank with a nudge for direction of travel: ground the body is heading into
// is worth more than ground it is leaving, so a boundary crossing has something to
// stand on instead of waiting its turn behind an equally distant but irrelevant chunk.
function rank(i, j, motion) {
  const base = i * i + j * j;
  if (!motion) return base;
  const speed = Math.hypot(motion.vx ?? 0, motion.vz ?? 0);
  if (!(speed > 0.3)) return base;
  return base - ((i * motion.vx + j * motion.vz) / speed) * 1.5;
}

// The unit of streaming work is a height sample, not a chunk: one 128-segment chunk is
// two hundred of the coarse ring. `heightSamples` is what a single `update` may spend,
// `pendingSwaps` how many outgoing meshes may coexist with their replacements.
export const TERRAIN_BUDGET = Object.freeze({
  heightSamples: 6000,
  // Two chunks, whatever they weigh, and never more samples than the budget above:
  // the count cap alone let a frame take two 128-segment chunks, the sample cap alone
  // let it take five trivial ones. Both bounds have to hold.
  maxChunksPerFrame: 2,
  pendingSwaps: 2,
});

export class ChunkManager {
  constructor(scene, state, options = {}) {
    this.scene = scene;
    this.state = state;
    this.chunks = new Map();
    this.queue = [];
    this.radius = 3;
    this.vegRadius = 1;
    this.material = applyGroundShader(
      new THREE.MeshLambertMaterial({ vertexColors: true }),
    );
    this.material.side = THREE.FrontSide;
    this.onChunkBuild = null; // set by vegetation system
    this.onChunkRemove = null;
    this.onRingChange = null;
    this.center = { i: 9999, j: 9999 };
    this.budget = { ...TERRAIN_BUDGET, ...(options?.budget || {}) };
    this.queue = [];
    this.pendingSwaps = 0;
    this.work = {
      frames: 0,
      samples: 0,
      maxSamples: 0,
      holes: 0,
      held: 0,
      supported: false,
    };
  }

  keyOf(i, j) {
    return i + "," + j;
  }

  // One frame of streaming work, spent where it buys the least visible damage.
  //
  // `update` used to build `budget` chunks per frame and count every chunk the same.
  // They are not the same: the chunk under you is 128 segments (16,641 height
  // samples through the full noise pipeline) and the ring outside is 8 or 16, so a
  // budget of two could mean ~400 samples or ~33,000 depending on which two landed.
  // The expensive part always arrived on a boundary crossing, which is precisely when
  // the body is also stepping onto new ground - the hitch was structural.
  //
  // So the pump spends a *sample* budget, a chunk's height field is filled in row
  // bands across frames, and an outgoing mesh is kept until its replacement exists.
  // The work per frame is bounded, the queue can never leave a hole, and a partly built
  // chunk is never visible: it only joins the scene when its shading pass has run.
  update(px, pz, maxChunks = 4, motion = null) {
    const C = WORLD.chunk;
    const ci = Math.floor(px / C),
      cj = Math.floor(pz / C);
    if (ci !== this.center.i || cj !== this.center.j) {
      this.center = { i: ci, j: cj };
      this.rebuildList(ci, cj, motion);
    }
    this.pump(maxChunks);
  }

  pump(maxChunks = 4) {
    const budget = this.budget;
    const cap = Math.max(1, Math.min(budget.maxChunksPerFrame, maxChunks));
    let spent = 0,
      landed = 0;
    this.work.frames++;
    while (this.queue.length && spent < budget.heightSamples && landed < cap) {
      const task = this.queue[0],
        key = this.keyOf(task.i, task.j);
      const current = this.chunks.get(key);
      if (!task.rec) {
        if (current && !current.dirty && current.lod === task.lod) {
          this.queue.shift();
          continue;
        }
        task.rec = this.startHeights(task, current);
      }
      const rec = task.rec,
        rows = Math.max(
          1,
          Math.min(
            rec.n - rec.rows,
            Math.ceil((budget.heightSamples - spent) / rec.n),
          ),
        );
      spent += this.advanceHeights(rec, rows) * rec.n;
      if (rec.rows < rec.n) {
        // Out of budget for this frame. The task keeps its progress and stays at the
        // head, so no other chunk can overtake a half-built one.
        break;
      }
      this.queue.shift();
      this.finishChunk(task, current);
      landed++;
    }
    this.work.lastSamples = spent;
    this.work.samples += spent;
    if (spent > this.work.maxSamples) this.work.maxSamples = spent;
    if (this.pendingSwaps) this.work.held += 1;
    // A hole is ground the body was standing on that has gone. A region filling in for
    // the first time is a cold start rather than a regression, and an unfinished chunk
    // is not visible either way, so only a loss counts. This is the number the held
    // swap exists to keep at zero.
    const here = this.keyOf(this.center.i, this.center.j),
      present = this.chunks.has(here);
    if (this.work.supported && !present) this.work.holes++;
    this.work.supported = present;
  }

  startHeights(task, current) {
    const C = WORLD.chunk,
      n = task.lod + 1,
      ox = task.i * C,
      oz = task.j * C;
    // Hold the outgoing mesh while the new one is built, but only a bounded number at
    // once: a stage change re-queues every chunk, and overlapping all of them would
    // trade a hitch for a pile of geometries the teardown test would rightly reject.
    if (current) {
      if (this.pendingSwaps < this.budget.pendingSwaps) {
        task.holds = current;
        this.pendingSwaps++;
      } else this.disposeChunk(this.keyOf(task.i, task.j));
    }
    return {
      key: this.keyOf(task.i, task.j),
      i: task.i,
      j: task.j,
      segs: task.lod,
      ring: task.ring,
      n,
      step: C / task.lod,
      ox,
      oz,
      rows: 0,
      heights: new Float32Array(n * n),
    };
  }

  advanceHeights(rec, rows) {
    const { heights, n, step, ox, oz } = rec;
    const end = Math.min(n, rec.rows + rows);
    for (let j = rec.rows; j < end; j++) {
      const base = j * n;
      for (let i = 0; i < n; i++) {
        const x = ox + i * step,
          z = oz + j * step;
        heights[base + i] = this.state.sampleHeight?.(x, z) ?? heightAt(x, z);
      }
    }
    const done = end - rec.rows;
    rec.rows = end;
    return done;
  }

  finishChunk(task, current) {
    const rec = task.rec,
      { heights, n, step, segs, ox, oz } = rec;
    const positions = new Float32Array(n * n * 3),
      colors = new Float32Array(n * n * 3),
      normals = new Float32Array(n * n * 3);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const idx = j * n + i;
        const x = ox + i * step,
          z = oz + j * step;
        const h = heights[idx];
        const hl = heights[j * n + Math.max(0, i - 1)],
          hr = heights[j * n + Math.min(n - 1, i + 1)];
        const hd = heights[Math.max(0, j - 1) * n + i],
          hu = heights[Math.min(n - 1, j + 1) * n + i];
        const sx = (hl - hr) / (2 * step),
          sz = (hd - hu) / (2 * step);
        let nx = sx,
          ny = 1,
          nz = sz;
        const len = Math.hypot(nx, ny, nz);
        nx /= len;
        ny /= len;
        nz /= len;
        const slope = 1 - ny;
        const m = clamp(
          fbm2(x * 0.0022 + 100, z * 0.0022 - 60, 3, WORLD.seed + 11) * 0.72 +
            (1 - clamp((h - 2) / 24, 0, 1)) * 0.3,
          0,
          1,
        );
        colorFor(h, slope, m, tmpC);
        const grain = (valueNoise2(x * 0.09, z * 0.09, 7) - 0.5) * 0.07;
        positions[idx * 3] = i * step;
        positions[idx * 3 + 1] = h;
        positions[idx * 3 + 2] = j * step;
        normals[idx * 3] = nx;
        normals[idx * 3 + 1] = ny;
        normals[idx * 3 + 2] = nz;
        colors[idx * 3] = clamp(tmpC.r + grain, 0, 1);
        colors[idx * 3 + 1] = clamp(tmpC.g + grain, 0, 1);
        colors[idx * 3 + 2] = clamp(tmpC.b + grain, 0, 1);
      }
    }
    const indices = new Uint32Array(segs * segs * 6);
    let p = 0;
    for (let j = 0; j < segs; j++) {
      for (let i = 0; i < segs; i++) {
        const a = j * n + i,
          b = a + 1,
          c = a + n,
          d = c + 1;
        indices[p++] = a;
        indices[p++] = c;
        indices[p++] = b;
        indices[p++] = b;
        indices[p++] = c;
        indices[p++] = d;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeBoundingSphere();

    const mesh = new THREE.Mesh(geo, this.material);
    mesh.position.set(ox, 0, oz);
    mesh.receiveShadow = rec.ring <= 1;
    mesh.castShadow = false;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.scene.add(mesh);
    // The replacement exists now, so the held mesh goes with it, and only then.
    if (task.holds) this.pendingSwaps--;
    // A carried partial task may have lost its hold marker during ring planning.
    // The map still owns the outgoing geometry; always release it before replacing it.
    if (this.chunks.has(rec.key)) this.disposeChunk(rec.key);
    const built = {
      mesh,
      lod: segs,
      ring: rec.ring,
      i: rec.i,
      j: rec.j,
      ox: rec.ox,
      oz: rec.oz,
      heights: rec.heights,
      segs,
    };
    this.chunks.set(rec.key, built);
    task.rec = null;
    if (this.onChunkBuild) this.onChunkBuild(rec.key, built, rec.ring);
  }

  // Re-plan what the region around the body needs. Tasks keep their build progress
  // when they survive a re-plan, and an outgoing mesh is released by the pump once its
  // replacement exists - never here, which is what stops a boundary crossing from
  // showing a frame with no ground.
  rebuildList(ci, cj, motion) {
    const wanted = new Set(),
      list = [];
    // Held swaps must be accounted for before the queue is replaced, or the counter
    // drifts and the overlap budget stops meaning anything.
    for (const task of this.queue)
      if (task.holds) {
        task.holds = null;
        this.pendingSwaps--;
      }
    const carried = this.queue.length ? this.queue[0] : null;
    for (let j = -this.radius; j <= this.radius; j++) {
      for (let i = -this.radius; i <= this.radius; i++) {
        const ring = Math.max(Math.abs(i), Math.abs(j)),
          b = CHANNEL_BOUNDS,
          overlaps =
            (ci + i + 1) * WORLD.chunk >= b.minX &&
            (ci + i) * WORLD.chunk <= b.maxX &&
            (cj + j + 1) * WORLD.chunk >= b.minZ &&
            (cj + j) * WORLD.chunk <= b.maxZ,
          // A carved groove is under half a metre wide and fits inside one 24 m chunk,
          // so only the chunk you stand on needs 128 segments. Forcing it on the ring
          // around you quadruples the scene for detail nobody can resolve from 24 m away.
          cut = overlaps && this.state.frontier?.stage > 0,
          lod = cut
            ? ring === 0
              ? 128
              : Math.max(32, ring === 1 ? 64 : 16)
            : ring <= 1
              ? 32
              : ring === 2
                ? 16
                : 8,
          gi = ci + i,
          gj = cj + j,
          k = this.keyOf(gi, gj);
        wanted.add(k);
        const ex = this.chunks.get(k);
        if (!ex || ex.dirty || ex.lod !== lod) {
          const keep =
            carried &&
            carried.rec &&
            carried.rec.key === k &&
            carried.lod === lod &&
            carried.rec.rows < carried.rec.n
              ? carried.rec
              : null;
          list.push({
            i: gi,
            j: gj,
            lod,
            ring,
            d: rank(i, j, motion),
            rec: keep,
          });
        }
      }
    }
    list.sort((a, b) => a.d - b.d);
    this.queue = list;
    for (const k of [...this.chunks.keys()])
      if (!wanted.has(k)) this.disposeChunk(k);
    // Chunks that stay but change ring (grass only lives in the closest ring).
    for (let j = -this.radius; j <= this.radius; j++) {
      for (let i = -this.radius; i <= this.radius; i++) {
        const k = this.keyOf(ci + i, cj + j),
          ex = this.chunks.get(k);
        if (!ex) continue;
        const ring = Math.max(Math.abs(i), Math.abs(j));
        if (ex.ring !== ring) {
          ex.ring = ring;
          if (this.onRingChange) this.onRingChange(k, ex, ring);
        }
      }
    }
  }

  disposeChunk(k) {
    const c = this.chunks.get(k);
    if (!c) return;
    this.scene.remove(c.mesh);
    c.mesh.geometry.dispose();
    if (this.onChunkRemove) this.onChunkRemove(k, c);
    this.chunks.delete(k);
    // With no ground at all in the region, there is nothing left to lose: a place change
    // empties everything and refills, and that fill must not be read as a hole.
    if (!this.chunks.size) this.work.supported = false;
  }

  // Kept as the synchronous path for anything that must have the ground right now -
  // a stage rebuild at boot, or a test that wants one chunk and no time steps.
  buildChunk(ci, cj, segs, ring) {
    const task = { i: ci, j: cj, lod: segs, ring };
    const rec = this.startHeights(task, this.chunks.get(this.keyOf(ci, cj)));
    task.rec = rec;
    this.advanceHeights(rec, rec.n);
    this.finishChunk(task, this.chunks.get(this.keyOf(ci, cj)));
    return this.chunks.get(this.keyOf(ci, cj));
  }
}

// --------------------------------------------------------------------------
export function makeWater(scene) {
  const geo = new THREE.PlaneGeometry(
    WORLD.size * 1.6,
    WORLD.size * 1.6,
    48,
    48,
  );
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({
    color: 0x2f5a63,
    transparent: true,
    opacity: 0.82,
    depthWrite: true,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.uTime;
    sh.vertexShader =
      "uniform float uTime;\nvarying vec3 vWP;\n" +
      sh.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
       vec3 wp = (modelMatrix * vec4(transformed,1.0)).xyz;
       transformed.y += sin(wp.x * 0.06 + uTime * 1.1) * 0.22 + sin(wp.z * 0.045 - uTime * 0.8) * 0.20;
       vWP = wp;`,
      );
    sh.fragmentShader =
      "varying vec3 vWP;\nuniform float uTime;\n" +
      sh.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
       float ripple = sin(vWP.x*0.55 + uTime*1.7) * sin(vWP.z*0.5 - uTime*1.3);
       diffuseColor.rgb += ripple * 0.035;
       diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62,0.80,0.83), smoothstep(0.75,1.0,ripple)*0.35);`,
      );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = WORLD.water - 0.05;
  mesh.renderOrder = 1;
  scene.add(mesh);
  return mesh;
}
