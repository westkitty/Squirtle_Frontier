import * as THREE from "three";
import { pixelRatioFor } from "./render-quality.js";
import { WorldState } from "./worldstate.js";
import { heightAt } from "./worldgen.js";
import { Streaming } from "./streaming.js";
import { Input } from "./input.js";
import { Loop } from "./loop.js";
import { Settings } from "./settings.js";
import { save, load, advanceOffline } from "./persistence.js";
import { AssetManager } from "./assets/asset-manager.js";
import { SquirtlePresentation } from "./assets/squirtle-presentation.js";
import { createBody } from "./player/body-state.js";
import { stepBody } from "./player/squirtle-controller.js";
import { CreatureCamera } from "./player/creature-camera.js";
import { region } from "./player/movement-region.js";
import { MovementScenery } from "./player/movement-scenery.js";
import { applyWaterJet, senseWater } from "./simulation/water-interaction.js";
import { WatershedPresentation } from "./player/watershed-presentation.js";
import {
  HabitatView,
  LAB_ENTRY,
  labRegion,
  labHeight,
} from "./player/habitat-view.js";
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
      state.place === "lab"
        ? labHeight(state.player.x, state.player.z)
        : heightAt(state.player.x, state.player.z),
    );
    const frontierGroup = new THREE.Group();
    scene.add(frontierGroup);
    const streaming = new Streaming(frontierGroup, state),
      scenery = new MovementScenery(frontierGroup, streaming),
      watershedView = new WatershedPresentation(frontierGroup),
      habitat = new HabitatView(frontierGroup),
      liveRegion = {
        ...region,
        water: (x, z) => {
          const water = region.water(x, z);
          if (!water) return null;
          const flow = state.watershed.nodes[2].flow;
          return { ...water, currentX: 0.08 * flow, currentZ: -0.18 * flow };
        },
      },
      rig = new CreatureCamera(camera, liveRegion);
    let lab = null,
      interactionHeld = false;
    const enterPlace = (place, relocate = true) => {
      if (place === "lab") {
        if (relocate) state.frontierReturn = { x: body.x, z: body.z };
        streaming.suspend();
        frontierGroup.visible = false;
        lab ??= new HabitatView(scene, { lab: true });
        if (relocate) Object.assign(body, createBody(0, 5, 0));
        rig.env = labRegion;
      } else {
        lab?.dispose();
        lab = null;
        frontierGroup.visible = true;
        if (relocate)
          Object.assign(
            body,
            createBody(
              state.frontierReturn.x,
              state.frontierReturn.z,
              heightAt(state.frontierReturn.x, state.frontierReturn.z),
            ),
          );
        rig.env = liveRegion;
      }
      state.place = place;
      state.player = { x: body.x, z: body.z };
      rig.initial = true;
      input.clear();
      document.querySelector("h1").textContent =
        place === "lab" ? "The Listening Basin" : "Stillwater Reach";
    };
    if (state.place === "lab") enterPlace("lab", false);
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
      watershedView.dispose();
      habitat.dispose();
      lab?.dispose();
      audio.dispose();
      disposePromise = assets.disposeAll().finally(() => renderer.dispose());
      return disposePromise;
    };
    addEventListener(
      "pagehide",
      () => {
        if (!document.hidden) save(state, localStorage);
        cleanup();
      },
      { ...options, once: true },
    );
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
        if (state.place === "lab") enterPlace("frontier");
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
        const inLab = state.place === "lab";
        const atDoor = inLab
          ? Math.hypot(body.x, body.z - 6) < 2
          : Math.hypot(body.x - LAB_ENTRY.x, body.z - LAB_ENTRY.z) < 2.5;
        document.querySelector("#interact").hidden = !atDoor;
        document.querySelector("#interact").textContent = inLab
          ? "Leave basin · R"
          : "Enter basin · R";
        if (controls.interact && !interactionHeld && atDoor) {
          enterPlace(inLab ? "frontier" : "lab");
        }
        interactionHeld = !!controls.interact;
        const env = state.place === "lab" ? labRegion : liveRegion;
        stepBody(body, { ...controls, ...world }, env, dt);
        if (state.place === "lab") {
          body.x = Math.max(-7.5, Math.min(7.5, body.x));
          body.z = Math.max(-7.5, Math.min(7.5, body.z));
        } else applyWaterJet(state.watershed, body, dt);
        state.update(dt);
        if (state.place === "frontier")
          habitat.update(state.ecosystem, body, state.elapsed);
        lab?.update(state.ecosystem, body, state.elapsed);
        const signal = controls.sense
          ? senseWater(
              state.watershed,
              body,
              !!liveRegion.water(body.x, body.z) && body.y < 0.3,
            )
          : null;
        watershedView.update(state.watershed, body, !!signal, state.elapsed);
        scenery.water.material.opacity =
          0.35 + state.watershed.nodes[2].wetness * 0.25;
        scenery.water.material.color.setHSL(
          0.48,
          0.22 + state.watershed.nodes[2].wetness * 0.18,
          0.38,
        );
        if (controls.sense && state.place === "lab")
          status.textContent =
            state.ecosystem.labWater > 0.5
              ? "Fresh water carries reed seeds into the basin."
              : "The basin waits for water from the wetland.";
        else if (controls.sense)
          status.textContent =
            signal?.message || "Touch the water to listen to its current.";
        state.player.x = body.x;
        state.player.z = body.z;
        creature.present(body, dt);
        if (state.place === "frontier") scenery.update(body, dt);
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
        if (state.place === "frontier") streaming.update(body.x, body.z);
        rig.update(body, input.consumeLook(), cameraDt, {
          ...Settings.values,
          reducedMotion: Settings.motionReduced,
        });
        const underwater =
          camera.position.y < (state.place === "lab" ? -0.2 : 0) &&
          (state.place === "lab" ? labRegion : liveRegion).water(
            camera.position.x,
            camera.position.z,
          );
        scene.fog.color.set(
          underwater
            ? "#246c69"
            : state.place === "lab"
              ? "#597b76"
              : "#9bb9aa",
        );
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
    let hiddenAt = null;
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) {
          hiddenAt = Date.now();
          save(state, localStorage);
        } else if (hiddenAt !== null) {
          advanceOffline(state, Math.max(0, (Date.now() - hiddenAt) / 1000));
          hiddenAt = null;
          const r = save(state, localStorage);
          if (!r.ok) status.textContent = r.message;
        }
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
      enterPlace,
      habitat,
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
    status.textContent =
      loaded.message ||
      (loaded.ok
        ? loaded.seconds > 0
          ? `The watershed continued for ${loaded.seconds} seconds${loaded.capped ? " (six-hour cap)" : ""}.`
          : "Follow the shore. The stone doorway leads to the Listening Basin."
        : "Save unavailable.");
  } catch (error) {
    cleanup();
    loading.hidden = false;
    loading.textContent = `Could not reach the shore: ${error.message}`;
    console.error(error);
  }
}
void boot();
