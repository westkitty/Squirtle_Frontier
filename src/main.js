import { AdaptiveScale } from "./adaptive-quality.js";
import { NearWildlife } from "./simulation/near-wildlife.js";
import {
  settlementObstacles,
  settlementDialogue,
} from "./simulation/settlement.js";
import { channelSample } from "./simulation/channel-terrain.js";
import { REACHES, reachAt, reachById } from "./simulation/reaches.js";
import { reachWaterState } from "./simulation/water-level.js";
import { bindRecovery } from "./recovery-ui.js";
import { WorldEffects } from "./player/world-effects.js";
import { DeepRecord, recordRegion } from "./player/deep-record.js";
import {
  RECORD_BANDS,
  advanceStrataHold,
  deepTimeLedger,
  recordRows,
  strataHoldReady,
} from "./simulation/deep-history.js";
import { LANDMARKS } from "./simulation/place-memory.js";
import * as THREE from "three";
import { pixelRatioFor } from "./render-quality.js";
import { WorldState } from "./worldstate.js";
import { heightAt } from "./worldgen.js";
import { Streaming } from "./streaming.js";
import { Input } from "./input.js";
import { Loop } from "./loop.js";
import { Settings } from "./settings.js";
import {
  save,
  load,
  commitSave,
  adoptStored,
  advanceOffline,
} from "./persistence.js";
import { AssetManager } from "./assets/asset-manager.js";
import { SquirtlePresentation } from "./assets/squirtle-presentation.js";
import { createBody } from "./player/body-state.js";
import { stepBody } from "./player/squirtle-controller.js";
import { resolveAttentionTarget } from "./player/creature-attention.js";
import { CreatureCamera } from "./player/creature-camera.js";
import { region } from "./player/movement-region.js";
import { MovementScenery } from "./player/movement-scenery.js";
import {
  applyWaterJet,
  applyWorldJet,
  senseWater,
  DEBRIS_SITE,
} from "./simulation/water-interaction.js";
import { WatershedPresentation } from "./player/watershed-presentation.js";
import { HabitatView, labRegion, labHeight } from "./player/habitat-view.js";
import { placeAction } from "./simulation/place-interaction.js";
import { channelDistance } from "./simulation/channel-terrain.js";
import { Audio } from "./audio.js";
import { flashStatus, settleStatus } from "./status-note.js";
const status = document.querySelector("#status"),
  loading = document.querySelector("#loading"),
  recordReadout = document.querySelector("#record-readout");
// Module scope, because cleanup can run from a pagehide during boot: a `let` declared
// later in the boot body would still be in its temporal dead zone when it is reached.
let cleanup = () => {},
  recordShown = "";
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
    renderer.toneMappingExposure = 1;
    const scene = new THREE.Scene(),
      frontierFogClear = new THREE.Color("#8fb8b5"),
      frontierFogRain = new THREE.Color("#6f8f91"),
      shelteredFog = new THREE.Color("#526f68"),
      underwaterFog = new THREE.Color("#1d5d62"),
      sunClear = new THREE.Color("#ffdfb0"),
      sunRain = new THREE.Color("#c7d4cf");
    scene.background = frontierFogClear.clone();
    scene.fog = new THREE.FogExp2(frontierFogClear.clone(), 0.018);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.04, 120);
    scene.add(new THREE.HemisphereLight(0xd9f0e2, 0x344b43, 2.2));
    const sun = new THREE.DirectionalLight(sunClear, 2);
    sun.position.set(-18, 30, 10);
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
      effects = new WorldEffects(frontierGroup),
      wildlife = new NearWildlife(state.seed),
      liveRegion = {
        ...region,
        obstaclesAt: (x, z) => [
          ...region.obstaclesAt(x, z),
          ...settlementObstacles,
        ],
        sample: (x, z) => channelSample(x, z, state.frontier.stage),
        // The wetland node is what animals react to when they choose a shore.
        get drinkQuality() {
          const node = state.watershed.nodes[2];
          return {
            wetness: node.wetness,
            contamination: node.contamination,
            sediment: node.sediment,
          };
        },
        water: (x, z) => {
          const water = region.water(x, z, state.waterLevel);
          if (!water) return null;
          const flow = state.watershed.nodes[2].flow;
          return { ...water, currentX: 0.08 * flow, currentZ: -0.18 * flow };
        },
      },
      rig = new CreatureCamera(camera, liveRegion);
    // Water in the named inflows is read through the predicate the body swims by, and only
    // re-read when the basin's level or the player's cut changes. Nothing here pretends to
    // move water: it is a measurement of where water already is.
    let reachWater = {},
      reachWaterKey = "";
    const readReachWater = () => {
      const key = `${state.frontier.stage}|${(state.waterLevel * 1000) | 0}`;
      if (key === reachWaterKey) return reachWater;
      reachWaterKey = key;
      reachWater = {};
      for (const reach of REACHES)
        reachWater[reach.id] = reachWaterState(
          reach,
          (x, z) => !!liveRegion.water(x, z),
        );
      return reachWater;
    };
    let record = null;
    let lab = null,
      interactionHeld = false;
    const enterPlace = (place, relocate = true) => {
      wildlife.clear();
      record?.dispose();
      record = null;
      if (place === "record") {
        lab?.dispose();
        lab = null;
        streaming.suspend();
        frontierGroup.visible = false;
        record = new DeepRecord(scene, state.seed);
        rig.env = recordRegion;
        Object.assign(body, createBody(0, 0, -0.3));
        body.grounded = false;
        body.mode = "swim";
      } else if (place === "lab") {
        if (relocate && state.place === "frontier")
          state.frontierReturn = { x: body.x, z: body.z };
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
      // The instrument belongs to the shaft. The HUD cadence would correct this within
      // three frames, but the caption and the readout share a column now, so a plate that
      // lingers for even three frames pushes the caption it no longer belongs above.
      recordReadout.hidden = place !== "record";
      document.querySelector("h1").textContent =
        place === "record"
          ? "The Deep Record"
          : place === "lab"
            ? "The Listening Basin"
            : "Stillwater Reach";
    };
    if (state.place !== "frontier") enterPlace(state.place, false);
    // A saved generation may remember where the body actually was, including
    // inside a room. Support state is re-derived by physics, never trusted.
    const resumeFromSave = () => {
      const pose = state.pose;
      rig.initial = true;
      if (!pose || pose.place !== state.place) return false;
      Object.assign(body, createBody(pose.x, pose.z, pose.y));
      body.yaw = pose.yaw;
      const env =
        state.place === "record"
          ? recordRegion
          : state.place === "lab"
            ? labRegion
            : liveRegion;
      for (let i = 0; i < 24; i++) stepBody(body, { x: 0, z: 0 }, env, 1 / 60);
      rig.initial = true;
      return true;
    };
    resumeFromSave();
    const abort = new AbortController(),
      options = { signal: abort.signal };
    bindRecovery(state, status, abort.signal);
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
      recordReadout.hidden = true;
      recordShown = "";
      watershedView.dispose();
      habitat.dispose();
      wildlife.clear();
      effects.dispose();
      record?.dispose();
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
    const adaptive = new AdaptiveScale({ enabled: Settings.get("adaptive") });
    const resize = () => {
      renderer.setPixelRatio(
        pixelRatioFor(
          Settings.get("quality"),
          innerWidth,
          innerHeight,
          devicePixelRatio,
        ) * adaptive.value,
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
    // The survey panel is only refreshed while visible; opening it must show the
    // current world state on the first frame, not after the HUD cadence catches up.
    const BEARINGS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    // Eight octants, and the round happens first so 7.6 wraps to N instead of
    // reaching an index the table does not have.
    const compassTo = (dx, dz) => {
      const octant = Math.atan2(dx, -dz),
        step = Math.PI / 4;
      return BEARINGS[
        Math.round(((octant + Math.PI * 2) % (Math.PI * 2)) / step) % 8
      ];
    };
    const refreshMemoryPanel = () => {
      document.querySelector("#remembered").textContent =
        state.memory.places
          .map((id) => LANDMARKS.find((l) => l.id === id).name)
          .join(" · ") || "Explore to remember places.";
      const n = state.memory.notable;
      const house = state.settlement,
        responses = {
          withdraw:
            "The water house keeps its door shut while jets and hard landings stay close.",
          "check-water":
            "The caretaker watches the empty trough, waiting for water.",
          watch: "The caretaker watches you from the doorway.",
          welcome:
            "The caretaker leaves a filled bowl by the door and lifts a hand.",
        };
      document.querySelector("#house-note").textContent = house.visits
        ? `${responses[house.response]} (${house.visits} visit${house.visits > 1 ? "s" : ""}).`
        : "The water house by the trough has not taken note of you yet.";
      const drinkCells = Object.keys(state.memory.drinks);
      let nearest = null;
      for (const key of drinkCells) {
        const [cx, cz] = key.split(",").map(Number),
          x = cx * 5 + 2.5,
          z = cz * 5 + 2.5,
          d = Math.hypot(x - body.x, z - body.z);
        if (!nearest || d < nearest.d)
          nearest = { d, bearing: compassTo(x - body.x, z - body.z) };
      }
      const issue = {
        dry: "the shallows are too dry to drink at",
        fouled: "the water is fouled and the herd will not drink",
        gone: "there is no open water left in the shallows",
      }[wildlife.waterIssue];
      document.querySelector("#drink-note").textContent =
        (drinkCells.length
          ? `Drink tracks in ${drinkCells.length} place${
              drinkCells.length > 1 ? "s" : ""
            }; nearest ${Math.round(nearest.d)} m ${nearest.bearing}.`
          : "No drink tracks yet. Animals drink where the shallows run clean.") +
        (wildlife.parched && issue ? ` Now ${issue}.` : "");
      const followed = state.memory.reaches
        .map((id) => reachById(id))
        .filter(Boolean);
      document.querySelector("#water-note").textContent = followed.length
        ? `Water followed: ${followed
            .map((r) => `${r.name} (${Math.round(r.length)} m)`)
            .join(" · ")}. ${followed.length} of ${REACHES.length} reaches, ${
            REACHES.filter((r) => readReachWater()[r.id]?.flowing).length
          } holding water.`
        : "No channels followed yet. Water runs down from the rim to the shallows.";
      const logged = state.memory.strata.length;
      document.querySelector("#strata-note").textContent = logged
        ? `The record is read in ${logged} of ${RECORD_BANDS} bands, down to band ${Math.max(...state.memory.strata) + 1}.`
        : "Nothing of the record is logged. Hold still inside a band of it until the shaft agrees you read it.";
      document.querySelector("#companion").textContent = n
        ? `A marked reed frog remembers ${n.encounters} quiet encounters. ${n.familiarity > 0.3 ? "It lingers nearby." : "It watches from the reeds."}`
        : "No familiar visitor yet. Life needs water and time.";
      document.querySelector("#survey").replaceChildren(
        ...Object.keys(state.memory.cells).map((key) => {
          const [x, z] = key.split(",").map(Number),
            r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          r.setAttribute("x", String((x + 14) * 5));
          r.setAttribute("y", String((z + 14) * 5));
          r.setAttribute("width", "5");
          r.setAttribute("height", "5");
          r.setAttribute("fill", "#96bbaa");
          return r;
        }),
      );
    };
    document.addEventListener("pointerdown", () => audio.unlock(), options);
    document.addEventListener("keydown", () => audio.unlock(), options);
    const panelNames = ["help", "settings", "memory"];
    const closePanel = (name, { announce = true, focusWorld = true } = {}) => {
      const panel = document.querySelector(`#${name}`),
        toggle = document.querySelector(`#${name}-toggle`),
        wasOpen = !panel.hidden;
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      if (!wasOpen) return false;
      if (announce)
        status.textContent = `${panel.querySelector("h2").textContent} closed.`;
      if (
        !panelNames.some(
          (other) => !document.querySelector(`#${other}`).hidden,
        )
      )
        input.setSuppressed(false);
      if (focusWorld) renderer.domElement.focus({ preventScroll: true });
      return true;
    };
    const openPanel = (name) => {
      for (const other of panelNames)
        if (other !== name)
          closePanel(other, { announce: false, focusWorld: false });
      const panel = document.querySelector(`#${name}`);
      panel.hidden = false;
      document
        .querySelector(`#${name}-toggle`)
        .setAttribute("aria-expanded", "true");
      status.textContent = `${panel.querySelector("h2").textContent} open. Press Escape to return to the world.`;
      input.setSuppressed(true);
      panel.focus({ preventScroll: true });
      if (name === "memory") refreshMemoryPanel();
    };
    for (const name of panelNames)
      document.querySelector(`#${name}-toggle`).addEventListener(
        "click",
        () => {
          const panel = document.querySelector(`#${name}`);
          if (panel.hidden) openPanel(name);
          else closePanel(name);
        },
        options,
      );
    for (const button of document.querySelectorAll("[data-close-panel]"))
      button.addEventListener(
        "click",
        () => closePanel(button.dataset.closePanel),
        options,
      );
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.code !== "Escape") return;
        let closed = null;
        for (const name of panelNames) {
          const panel = document.querySelector(`#${name}`);
          if (!panel.hidden) closed = panel.querySelector("h2").textContent;
          closePanel(name, { announce: false, focusWorld: false });
        }
        if (closed) status.textContent = `${closed} closed.`;
        input.setSuppressed(false);
        renderer.domElement.focus();
      },
      options,
    );
    for (const [id, key, type] of [
      ["sensitivity", "sensitivity", "number"],
      ["invert", "invertY", "boolean"],
      ["mute", "muted", "boolean"],
      ["volume", "volume", "number"],
      ["quality", "quality", "string"],
      ["adaptive", "adaptive", "boolean"],
      ["hints", "hints", "boolean"],
    ]) {
      const element = document.querySelector(`#${id}`);
      if (type === "boolean") element.checked = Settings.get(key);
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
          Settings.applyDocument();
          if (key === "adaptive") {
            adaptive.setEnabled(element.checked);
            status.textContent = element.checked
              ? "Adaptive resolution on."
              : "Adaptive resolution off; full detail restored.";
          }
          if (key === "hints")
            status.textContent = element.checked
              ? "Contextual guidance on."
              : "Contextual guidance off.";
          if (key === "quality" || key === "adaptive") resize();
        },
        options,
      );
    }
    // Motion preference is tri-state: follow the system, force reduce, force full.
    const motion = document.querySelector("#motion");
    motion.value =
      Settings.get("reducedMotion") === null
        ? "auto"
        : Settings.get("reducedMotion")
          ? "reduce"
          : "full";
    const applyMotion = () => {
      Settings.set(
        "reducedMotion",
        motion.value === "auto" ? null : motion.value === "reduce",
      );
      Settings.applyDocument();
      status.textContent =
        motion.value === "auto"
          ? `Camera motion follows the system (${Settings.motionReduced ? "reduced" : "full"}).`
          : motion.value === "reduce"
            ? "Camera motion reduced."
            : "Full camera motion.";
    };
    motion.addEventListener("change", applyMotion, options);
    matchMedia("(prefers-reduced-motion: reduce)").addEventListener(
      "change",
      () => {
        if (Settings.get("reducedMotion") === null) Settings.applyDocument();
      },
      options,
    );
    const saveState = document.querySelector("#save-state"),
      controllerState = document.querySelector("#controller-state");
    const noteSave = (result, label = "Saved locally") => {
      saveState.textContent = result.ok
        ? `${label} · just now`
        : `Save paused · ${result.message}`;
      return result;
    };
    saveState.textContent = loaded.ok
      ? loaded.fresh
        ? "No stored world yet."
        : loaded.recovered
          ? "Recovered backup · saving paused."
          : "Stored world loaded."
      : "Stored world unavailable · saving paused.";
    document.querySelector("#save").addEventListener(
      "click",
      () => {
        commitSave(state, localStorage).then((r) => {
          noteSave(r);
          status.textContent = r.ok
            ? "This place is remembered."
            : `${r.message} A blocked tab can adopt the newer stored world below.`;
        });
      },
      options,
    );
    document.querySelector("#follow-tab").addEventListener(
      "click",
      async () => {
        const before = state.place;
        const r = await adoptStored(state, localStorage);
        if (!r.ok) {
          status.textContent = r.message;
          return;
        }
        if (state.place !== before) enterPlace(state.place, false);
        resumeFromSave();
        status.textContent = `Adopted the newer stored world (${Math.round(
          state.elapsed,
        )}s of growth).`;
      },
      options,
    );
    document.querySelector("#reset").addEventListener(
      "click",
      () => {
        if (state.place !== "frontier") enterPlace("frontier");
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
    // The shaft is an instrument, so it is written once per change rather than once per
    // frame: descending re-renders on a new row set and on nothing else.
    const renderRecordReadout = (ledger) => {
      const rows = recordRows(ledger),
        signature = rows
          .map((row) => `${row.label}\u0000${row.value}`)
          .join("\u0001");
      if (signature === recordShown) return;
      recordShown = signature;
      recordReadout.replaceChildren(
        ...[
          Object.assign(document.createElement("dt"), {
            className: "eyebrow readout-title",
            textContent: "Stillwater measurement / 01",
          }),
          ...rows.map((row) => {
            const wrap = document.createElement("div");
            wrap.append(
              Object.assign(document.createElement("dt"), {
                textContent: row.label,
              }),
              Object.assign(document.createElement("dd"), {
                textContent: row.value,
              }),
            );
            return wrap;
          }),
        ],
      );
    };
    // Standing in a band for a moment is what turns a depth into a record.
    let strataHold = { band: -1, held: 0 },
      strataLoggedAt = -10;
    let hudTime = 0,
      saveTime = 0,
      lastRender = null,
      statusFlash = null,
      // The step callback owns the input sample; the render callback below needs to know
      // whether the player is reading a sense line without reaching out of scope.
      senseHeld = false,
      controllerSignature = "";
    const showHint = (key, text) => {
      if (
        !Settings.get("hints") ||
        Settings.values.seenHints[key] ||
        statusFlash
      )
        return false;
      Settings.values.seenHints[key] = true;
      Settings.save();
      statusFlash = flashStatus(status, text, statusFlash, 6);
      return true;
    };
    const loop = new Loop(
      (dt) => {
        const controls = input.sample(),
          world = rig.movement(controls.x, controls.z);
        senseHeld = !!controls.sense;
        const action = placeAction(state.place, body, {
          settlement: state.settlement,
          ecosystem: state.ecosystem,
        });
        document.querySelector("#interact").hidden = !action;
        document.querySelector("#interact").textContent =
          {
            enter: "Enter basin · R",
            leave: "Leave basin · R",
            rest: "Rest five minutes · R",
            record: "Enter the Deep Record · R",
            "record-exit": "Return to the basin · R",
            "drink-bowl": "Drink fresh water · R",
            "play-frogs": "Splash with frogs · R",
          }[action] || "";
        if (controls.interact && !interactionHeld && action) {
          if (action === "rest") {
            advanceOffline(state, 300);
            body.vx = 0;
            body.vy = 0;
            body.vz = 0;
            body.resting = true;
            input.clear();
            const r = save(state, localStorage);
            status.textContent = r.ok
              ? "Five quiet minutes. The watershed continued while you rested."
              : r.message;
          } else if (action === "drink-bowl") {
            if (state.settlement.drinkBowl()) {
              body.impact = 0.18;
              status.textContent =
                "You drink cool, clean water from the caretaker's bowl. The caretaker smiles.";
            }
          } else if (action === "play-frogs") {
            body.vy = 1.4;
            body.impact = 0.2;
            status.textContent =
              "You splash playfully in the shallows. The reed frogs chirp and hop among the reeds.";
          } else
            enterPlace(
              action === "record"
                ? "record"
                : action === "enter" || action === "record-exit"
                  ? "lab"
                  : "frontier",
            );
        }
        interactionHeld = !!controls.interact;
        const env =
          state.place === "record"
            ? recordRegion
            : state.place === "lab"
              ? labRegion
              : liveRegion;
        stepBody(body, { ...controls, ...world }, env, dt);
        if (state.place === "lab") {
          body.x = Math.max(-7.5, Math.min(7.5, body.x));
          body.z = Math.max(-7.5, Math.min(7.5, body.z));
        } else if (state.place === "record") {
          const r = Math.hypot(body.x, body.z);
          if (r > 3.4) {
            body.x *= 3.4 / r;
            body.z *= 3.4 / r;
          }
          const ledger = deepTimeLedger({
            eras: record.eras,
            y: body.y,
            tick: state.frontier.tick,
            history: state.frontier.history,
            nodes: state.watershed.nodes,
            stage: state.frontier.stage,
            diversion: state.frontier.diversion,
            read: state.memory.strata,
          });
          strataHold = advanceStrataHold(strataHold, ledger, body.vy, dt);
          if (
            strataHoldReady(strataHold) &&
            state.memory.markStrata(ledger.layer, ledger.layers)
          ) {
            strataLoggedAt = state.elapsed;
            strataHold = { band: -1, held: 0 };
          }
          status.textContent =
            record.describe(body.y) +
            (state.elapsed - strataLoggedAt < 2.5
              ? " This band is logged."
              : "");
          record.update(body, state.memory, strataHold, state.elapsed);
          renderRecordReadout(ledger);
        } else {
          applyWaterJet(state.watershed, body, dt);
          applyWorldJet(state.frontier, body, dt);
        }
        // A reading is earned in the shaft or not at all: leaving must not bank progress
        // toward logging a band that was never stood in.
        if (state.place !== "record") strataHold = { band: -1, held: 0 };
        const previousTick = state.frontier.tick;
        state.update(dt);
        if (state.frontier.tick !== previousTick) {
          state.memory.observe(
            body,
            state.place,
            state.frontier.tick,
            state.ecosystem,
          );
          state.memory.noteDrinks(body, wildlife.drinkers);
        }
        if (state.frontier.tick !== previousTick)
          state.settlement.observe(body, state.place, state.frontier.tick);
        wildlife.step(dt, body, state.place, state.ecosystem, liveRegion);
        const currentWater = (state.place === "frontier"
          ? liveRegion
          : state.place === "lab"
            ? labRegion
            : recordRegion
        ).water(body.x, body.z, state.waterLevel);
        if (state.place === "frontier")
          effects.update(state, body, {
            water: currentWater,
            isShaking: creature?.isShaking ?? false,
            renderScale: adaptive.value,
            channelFlow: state.watershed.nodes[2].flow,
          });
        if (state.place === "frontier")
          habitat.update(
            state.ecosystem,
            body,
            state.elapsed,
            null,
            wildlife,
            state.settlement,
            dt,
          );
        lab?.update(state.ecosystem, body, state.elapsed, state.memory.notable);
        const signal = controls.sense
          ? senseWater(
              state.watershed,
              body,
              !!liveRegion.water(body.x, body.z) && body.y < 0.3,
              state.frontier,
            )
          : null;
        watershedView.update(
          state.watershed,
          body,
          !!signal,
          state.elapsed,
          state.memory.reaches,
          state.frontier.stage,
          readReachWater(),
        );
        const wetland = state.watershed.nodes[2],
          sediment = THREE.MathUtils.clamp(wetland.sediment ?? 0, 0, 1),
          contamination = THREE.MathUtils.clamp(
            wetland.contamination ?? 0,
            0,
            1,
          );
        scenery.water.material.opacity =
          0.48 + wetland.wetness * 0.16 + sediment * 0.06;
        scenery.water.material.color.setHSL(
          0.49 - sediment * 0.12 - contamination * 0.035,
          0.34 + wetland.wetness * 0.16 - contamination * 0.12,
          0.31 + wetland.wetness * 0.04 - sediment * 0.06,
        );
        if (controls.sense && state.place === "lab")
          status.textContent =
            state.ecosystem.labWater > 0.5
              ? "Fresh water carries reed seeds into the basin."
              : "The basin waits for water from the wetland.";
        else if (controls.sense) {
          const reach = reachAt(body.x, body.z),
            flow = reach ? readReachWater()[reach.id] : null,
            above = reach
              ? state.sampleHeight(body.x, body.z) - state.waterLevel
              : 0;
          status.textContent = `${
            signal?.message || "Touch the water to listen to its current."
          }${
            reach
              ? ` You are on the ${reach.name}${
                  reach.cut && state.frontier.stage === 0
                    ? ", still a dry groove"
                    : flow?.flowing
                      ? ", carrying water"
                      : flow && flow.fraction > 0
                        ? ", water in patches"
                        : ", a dry channel"
                }; ${Math.round(reach.toMouth)} m to the shallows${
                  above > 0.25
                    ? `, ${above.toFixed(1)} m above the water`
                    : ", at the water"
                }.`
              : ""
          }`;
        } else if (state.place === "frontier") {
          const dialogue = settlementDialogue(state.settlement, body);
          if (dialogue) status.textContent = dialogue;
        }
        if (body.mode === "swim" || body.mode === "dive")
          showHint(
            "swim",
            "Water changes your body: Q dives, E rises, and Space sends Water Jet.",
          );
        if (
          state.place === "frontier" &&
          state.watershed.nodes[1].blockage > 0.1 &&
          Math.hypot(body.x - DEBRIS_SITE.x, body.z - DEBRIS_SITE.z) < 11
        )
          showHint(
            "sense",
            "The current feels wrong here. Hold F / Sense while touching water to read it.",
          );
        if (state.place === "record")
          showHint(
            "record",
            "The Deep Record logs patience: hold still inside one band of strata.",
          );
        state.player.x = body.x;
        state.player.z = body.z;
        // Full pose: a saved x/z pair would drop the body through a basin floor.
        state.pose = {
          x: +body.x.toFixed(4),
          y: +body.y.toFixed(4),
          z: +body.z.toFixed(4),
          yaw: +body.yaw.toFixed(4),
          place: state.place,
        };
        const attention = resolveAttentionTarget({
          body,
          place: state.place,
          state,
          wildlife,
          settlement: state.settlement,
        });
        creature.present(body, dt, attention);
        if (state.place === "frontier")
          scenery.update(body, dt, state.waterLevel);
        audio.update(body, Settings.values, {
          water: currentWater,
          isShaking: creature?.isShaking ?? false,
          isSleeping: creature?.isSleeping ?? false,
          channelStage: state.place === "frontier" ? state.frontier.stage : 0,
          channelDist:
            state.place === "frontier" && state.frontier.stage >= 2
              ? channelDistance(body.x, body.z)
              : 999,
        });
        // A transient notice hands the caption back once it has had its moment, and only
        // if nothing else has spoken in the meantime.
        statusFlash = settleStatus(status, statusFlash, dt);
        saveTime += dt;
        if (saveTime >= 30) {
          saveTime = 0;
          commitSave(state, localStorage).then((r) => {
            noteSave(r, "Autosaved");
            if (!r.ok) status.textContent = r.message;
          });
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
        const cameraEnv =
            state.place === "record"
              ? recordRegion
              : state.place === "lab"
                ? labRegion
                : liveRegion,
          cameraWater = cameraEnv.water(
            camera.position.x,
            camera.position.z,
            state.waterLevel,
          ),
          underwater =
            camera.position.y < (state.place === "lab" ? -0.2 : 0) &&
            !!cameraWater,
          rain =
            state.place === "frontier"
              ? THREE.MathUtils.clamp(state.frontier.weather.rain, 0, 1)
              : 0;
        if (underwater) {
          const depth = Math.max(0, cameraWater.level - camera.position.y);
          scene.fog.color.copy(underwaterFog).lerp(frontierFogRain, 0.12);
          scene.fog.density = 0.095 + Math.min(0.08, depth * 0.025);
        } else if (state.place === "frontier") {
          scene.fog.color
            .copy(frontierFogClear)
            .lerp(frontierFogRain, rain * 0.78);
          scene.fog.density = 0.016 + rain * 0.016;
        } else {
          scene.fog.color.copy(shelteredFog);
          scene.fog.density = 0.025;
        }
        sun.intensity = 2 - rain * 0.65;
        sun.color.copy(sunClear).lerp(sunRain, rain * 0.82);
        scene.background.copy(scene.fog.color);
        renderer.render(scene, camera);
        const previousFrame = loop.frames.at(-1);
        if (
          previousFrame !== undefined &&
          adaptive.add(previousFrame) !== null
        ) {
          resize();
          // The scale notice is transient, so it must not overwrite a readout the player
          // is deliberately asking for with the sense key held down.
          if (!senseHeld)
            statusFlash = flashStatus(
              status,
              `Render scale ${Math.round(adaptive.value * 100)}%.`,
              statusFlash,
            );
        }
        hudTime++;
        if (hudTime % 3 === 0) {
          document.querySelector("#weather").textContent =
            state.place === "frontier"
              ? state.frontier.weather.type
              : "Sheltered";
          if (!document.querySelector("#memory").hidden) refreshMemoryPanel();
          // The instrument belongs to the shaft and to nothing else.
          recordReadout.hidden = state.place !== "record";

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
          if (hudTime % 15 === 0) {
            const controller = input.gamepadStatus(),
              nextController = controller.connected
                ? `Controller: ${controller.name}`
                : "Controller: none detected.";
            if (nextController !== controllerSignature) {
              controllerSignature = nextController;
              controllerState.textContent = nextController;
            }
            if (controller.connected)
              showHint(
                "gamepad",
                "Controller ready: left stick moves, right stick looks; A jets and B shells.",
              );
          }
        }
      },
    );
    let contextPaused = false;
    renderer.domElement.addEventListener(
      "webglcontextlost",
      (event) => {
        event.preventDefault();
        contextPaused = true;
        renderer.setAnimationLoop(null);
        loading.hidden = false;
        loading.textContent =
          "Graphics paused. Waiting for the browser to restore the WebGL context…";
        status.textContent =
          "Rendering paused; the world state remains in memory.";
      },
      options,
    );
    renderer.domElement.addEventListener(
      "webglcontextrestored",
      () => {
        contextPaused = false;
        loop.reset();
        resize();
        loading.hidden = true;
        loading.textContent = "Finding the shore…";
        if (!document.hidden)
          renderer.setAnimationLoop((now) => loop.frame(now));
        status.textContent = "Graphics restored.";
      },
      options,
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
          commitSave(state, localStorage).then((r) => {
            if (!r.ok) status.textContent = r.message;
          });
        }
        loop.reset();
        renderer.setAnimationLoop(
          document.hidden || contextPaused ? null : (now) => loop.frame(now),
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
      adaptive,
      enterPlace,
      habitat,
      // Journeys assert what the Lab actually renders; the frontier view is `habitat`.
      labView: () => lab,
      wildlife,
      dispose: cleanup,
      stats: () => ({
        chunks: streaming.stats(),
        memory: { ...renderer.info.memory },
        render: { ...renderer.info.render },
        frames: [...loop.frames],
        assets: assets.stats(),
        mode: body.mode,
        attention: creature?.attention ?? null,
        gaze: creature ? { yaw: creature.gazeYaw, pitch: creature.gazePitch } : null,
        sleeping: creature?.isSleeping ?? false,
        sleepProgress: creature?.sleepProgress ?? 0,
        effects: {
          jet: effects?.jet?.count ?? 0,
          spray: scenery?.pool?.count ?? 0,
          wake: effects?.wake?.count ?? 0,
          splash: effects?.splash?.count ?? 0,
          foam: effects?.streamFoam?.count ?? 0,
        },
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
