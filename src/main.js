import * as THREE from 'three';
import { WorldState } from './worldstate.js';
import { heightAt, WORLD } from './worldgen.js';
import { Streaming } from './streaming.js';
import { Input } from './input.js';
import { Loop } from './loop.js';
import { Settings } from './settings.js';
import { save, load } from './persistence.js';
import { AssetManager } from './assets/asset-manager.js';
const status = document.querySelector('#status');
try {
  Settings.load();
  const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('canvas'), antialias: false });
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#a9c6c1'); scene.fog = new THREE.Fog('#a9c6c1', 100, 470);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 700);
  scene.add(new THREE.HemisphereLight(0xf1f4df, 0x344231, 2));
  const sun = new THREE.DirectionalLight(0xffeed0, 2); sun.position.set(40, 80, 10); scene.add(sun);
  const state = new WorldState(), input = new Input(), assets = new AssetManager();
  const loaded = load(state, localStorage);
  const streaming = new Streaming(scene, state);
  const abort = new AbortController(), options = { signal: abort.signal };
  const resize = () => { renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
  addEventListener('resize', resize, options); resize();
  const loop = new Loop(dt => {
    state.update(dt); const m = input.movement();
    state.player.x = THREE.MathUtils.clamp(state.player.x + m.x * dt * 24, -1000, 1000);
    state.player.z = THREE.MathUtils.clamp(state.player.z + m.z * dt * 24, -1000, 1000);
  }, () => {
    const p = state.player; streaming.update(p.x, p.z);
    const y = heightAt(p.x, p.z); camera.position.set(p.x, y + 6, p.z + 12); camera.lookAt(p.x, y + 1, p.z - 15);
    renderer.render(scene, camera);
  });
  document.querySelector('#save').addEventListener('click', () => { const r = save(state, localStorage); status.textContent = r.ok ? 'Inspection position saved.' : r.message; }, options);
  document.querySelector('#cycle').addEventListener('click', () => { state.player.x = state.player.x > 600 ? -140 : state.player.x + WORLD.chunk; }, options);
  document.addEventListener('visibilitychange', () => { loop.reset(); renderer.setAnimationLoop(document.hidden ? null : now => loop.frame(now)); }, options);
  const dispose = () => { renderer.setAnimationLoop(null); abort.abort(); input.dispose(); streaming.dispose(); assets.disposeAll(); renderer.dispose(); };
  addEventListener('pagehide', dispose, { ...options, once: true });
  if (import.meta.hot) import.meta.hot.dispose(dispose);
  window.__SF = { state, streaming, renderer, loop, assets, dispose, stats: () => ({ chunks: streaming.stats(), memory: { ...renderer.info.memory }, render: { ...renderer.info.render }, frames: [...loop.frames], assets: assets.stats() }) };
  renderer.setAnimationLoop(now => loop.frame(now));
  status.textContent = loaded.ok ? 'Inspection ready. Browser performance gate pending.' : loaded.message;
} catch (error) { status.textContent = `Baseline could not start: ${error.message}`; console.error(error); }
