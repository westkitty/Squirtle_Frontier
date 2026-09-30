import * as THREE from "three";
import { pixelRatioFor } from "./render-quality.js";
import { WorldState } from "./worldstate.js";
import { heightAt } from "./worldgen.js";
import { Streaming } from "./streaming.js";
import { Input } from "./input.js";
import { Loop } from "./loop.js";
import { Settings } from "./settings.js";
import { save, load } from "./persistence.js";
import { AssetManager } from "./assets/asset-manager.js";
import { SquirtlePresentation } from "./assets/squirtle-presentation.js";
import { createBody } from "./player/body-state.js";
import { stepBody } from "./player/squirtle-controller.js";
import { CreatureCamera } from "./player/creature-camera.js";
import { region } from "./player/movement-region.js";
import { MovementScenery } from "./player/movement-scenery.js";
import { Audio } from "./audio.js";
const status = document.querySelector("#status"),
  loading = document.querySelector("#loading");
let cleanup = () => {};
async function boot() {
  try {
    Settings.load();
    Settings.applyDocument();
    const renderer = new THREE.WebGLRenderer({
      canvas: document.querySelector("canvas"),
      antialias: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#9bb9aa");
    scene.fog = new THREE.FogExp2("#9bb9aa", 0.025);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.04, 120);
    scene.add(new THREE.HemisphereLight(0xe7f4da, 0x425549, 2.5));
    const sun = new THREE.DirectionalLight(0xffedd2, 2.4);
    sun.position.set(-15, 25, 12);
    scene.add(sun);
    const state = new WorldState(),
      assets = new AssetManager(),
      input = new Input(renderer.domElement),
      audio = new Audio();
    const loaded = load(state, localStorage); // Existing baseline saves can be outside the proving ground.
    if (Math.abs(state.player.x) > 70 || Math.abs(state.player.z) > 70)
      state.player = { x: -10, z: 18 };
    const body = createBody(
      state.player.x,
      state.player.z,
      heightAt(state.player.x, state.player.z),
    );
    const streaming = new Streaming(scene, state),
      scenery = new MovementScenery(scene, streaming),
      rig = new CreatureCamera(camera, region);
    const abort = new AbortController(),
      options = { signal: abort.signal };
    let disposed = false,
      creature = null,
      disposePromise = null;
    cleanup = () => {
      if (disposed) return disposePromise;
      disposed = true;
      renderer.setAnimationLoop(null);
      abort.abort();
      input.dispose();
      creature?.dispose();
      streaming.dispose();
      scenery.dispose();
      audio.dispose();
      disposePromise = assets.disposeAll().finally(() => renderer.dispose());
      return disposePromise;
    };
    addEventListener("pagehide", cleanup, { ...options, once: true });
    if (import.meta.hot) import.meta.hot.dispose(cleanup);
    const resize = () => {
      renderer.setPixelRatio(
        pixelRatioFor(
          Settings.get("quality"),
          innerWidth,
          innerHeight,
          devicePixelRatio,
        ),
      );
      renderer.setSize(innerWidth, innerHeight);
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
    };
    addEventListener("resize", resize, options);
    resize();
    document.body.classList.toggle(
      "touch",
      matchMedia("(pointer: coarse)").matches,
    );
    document.addEventListener("pointerdown", () => audio.unlock(), options);
    document.addEventListener("keydown", () => audio.unlock(), options);
    for (const name of ["help", "settings"])
      document.querySelector(`#${name}-toggle`).addEventListener(
        "click",
        () => {
          const panel = document.querySelector(`#${name}`);
          panel.hidden = !panel.hidden;
          document
            .querySelector(`#${name}-toggle`)
            .setAttribute("aria-expanded", String(!panel.hidden));
          input.clear();
        },
        options,
      );
    for (const [id, key, type] of [
      ["sensitivity", "sensitivity", "number"],
      ["invert", "invertY", "boolean"],
      ["motion", "reducedMotion", "boolean"],
      ["mute", "muted", "boolean"],
      ["volume", "volume", "number"],
      ["quality", "quality", "string"],
    ]) {
      const element = document.querySelector(`#${id}`);
      if (type === "boolean")
        element.checked =
          key === "reducedMotion" ? Settings.motionReduced : Settings.get(key);
      else element.value = Settings.get(key);
      element.addEventListener(
        "input",
        () => {
          Settings.set(
            key,
            type === "boolean"
              ? element.checked
              : type === "number"
                ? Number(element.value)
                : element.value,
          );
          if (key === "quality") resize();
        },
        options,
      );
    }
    document.querySelector("#save").addEventListener(
      "click",
      () => {
        const r = save(state, localStorage);
        status.textContent = r.ok ? "This place is remembered." : r.message;
      },
      options,
    );
    document.querySelector("#reset").addEventListener(
      "click",
      () => {
        Object.assign(body, createBody(-10, 18, heightAt(-10, 18)));
        rig.initial = true;
        input.clear();
        status.textContent = "Back on the bank.";
      },
      options,
    );
    creature = await SquirtlePresentation.create(assets);
    if (disposed) {
      creature.dispose();
      throw new Error("Boot cancelled");
    }
    scene.add(creature.root);
    let hudTime = 0,
      saveTime = 0,
      lastRender = null;
    const loop = new Loop(
      (dt) => {
        const controls = input.sample(),
          world = rig.movement(controls.x, controls.z);
        stepBody(body, { ...controls, ...world }, region, dt);
        state.update(dt);
        state.player.x = body.x;
        state.player.z = body.z;
        creature.present(body, dt);
        scenery.update(body, dt);
        audio.update(body, Settings.values);
        saveTime += dt;
        if (saveTime >= 30) {
          saveTime = 0;
          const r = save(state, localStorage);
          if (!r.ok) status.textContent = r.message;
        }
      },
      () => {
        const now = performance.now(),
          cameraDt =
            lastRender === null
              ? 1 / 60
              : Math.min(0.1, (now - lastRender) / 1000);
        lastRender = now;
        streaming.update(body.x, body.z);
        rig.update(body, input.consumeLook(), cameraDt, {
          ...Settings.values,
          reducedMotion: Settings.motionReduced,
        });
        const underwater =
          camera.position.y < 0 &&
          region.water(camera.position.x, camera.position.z);
        scene.fog.color.set(underwater ? "#246c69" : "#9bb9aa");
        scene.fog.density = underwater ? 0.13 : 0.025;
        scene.background.copy(scene.fog.color);
        renderer.render(scene, camera);
        hudTime++;
        if (hudTime % 3 === 0) {
          document.querySelector("#mode").textContent = {
            land:
              Math.hypot(body.vx, body.vz) > 0.2
                ? "On little feet"
                : "On the bank",
            swim: "At the surface",
            dive: "Below the surface",
            slide: "In your shell",
            air: "In the air",
          }[body.mode];
          document.querySelector("#speed").textContent =
            `${Math.hypot(body.vx, body.vz).toFixed(1)} m/s`;
          document.querySelector("#jet").value = 1 - body.jetCooldown / 1.1;
        }
      },
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        loop.reset();
        renderer.setAnimationLoop(
          document.hidden ? null : (now) => loop.frame(now),
        );
        if (document.hidden) audio.context?.suspend();
      },
      options,
    );
    window.__SF = {
      state,
      body,
      streaming,
      renderer,
      loop,
      assets,
      creature,
      rig,
      input,
      region,
      dispose: cleanup,
      stats: () => ({
        chunks: streaming.stats(),
        memory: { ...renderer.info.memory },
        render: { ...renderer.info.render },
        frames: [...loop.frames],
        assets: assets.stats(),
        mode: body.mode,
      }),
    };
    renderer.setAnimationLoop((now) => loop.frame(now));
    loading.hidden = true;
    status.textContent = loaded.ok
      ? "Try the water. It’s where you belong."
      : loaded.message;
  } catch (error) {
    cleanup();
    loading.hidden = false;
    loading.textContent = `Could not reach the shore: ${error.message}`;
    console.error(error);
  }
}
void boot();
