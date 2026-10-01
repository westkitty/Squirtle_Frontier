import { AdaptiveScale } from "./adaptive-quality.js";
import { NearWildlife } from "./simulation/near-wildlife.js";
import { settlementObstacles } from "./simulation/settlement.js";
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
import { CreatureCamera } from "./player/creature-camera.js";
import { region } from "./player/movement-region.js";
import { MovementScenery } from "./player/movement-scenery.js";
import {
  applyWaterJet,
  applyWorldJet,
  senseWater,
} from "./simulation/water-interaction.js";
import { WatershedPresentation } from "./player/watershed-presentation.js";
import { HabitatView, labRegion, labHeight } from "./player/habitat-view.js";
import { placeAction } from "./simulation/place-interaction.js";
import { Audio } from "./audio.js";
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
    for (const name of ["help", "settings", "memory"])
      document.querySelector(`#${name}-toggle`).addEventListener(
        "click",
        () => {
          const panel = document.querySelector(`#${name}`);
          panel.hidden = !panel.hidden;
          status.textContent = panel.hidden
            ? `${panel.querySelector("h2").textContent} closed.`
            : `${panel.querySelector("h2").textContent} open. Press Escape to return to the world.`;
          for (const other of ["help", "settings", "memory"]) {
            if (other === name) continue;
            document.querySelector(`#${other}`).hidden = true;
            document
              .querySelector(`#${other}-toggle`)
              .setAttribute("aria-expanded", "false");
          }
          document
            .querySelector(`#${name}-toggle`)
            .setAttribute("aria-expanded", String(!panel.hidden));
          // Focusing the opened panel announces its heading even when it holds
          // no controls; closing hands the world back to the canvas.
          if (!panel.hidden) {
            panel.focus({ preventScroll: true });
            if (name === "memory") refreshMemoryPanel();
          } else if (panel.contains(document.activeElement))
            renderer.domElement.focus({ preventScroll: true });
          input.clear();
        },
        options,
      );
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.code !== "Escape") return;
        let closed = null;
        for (const name of ["help", "settings", "memory"]) {
          const panel = document.querySelector(`#${name}`);
          if (!panel.hidden) {
            panel.hidden = true;
            closed = panel.querySelector("h2").textContent;
          }
          document
            .querySelector(`#${name}-toggle`)
            .setAttribute("aria-expanded", "false");
        }
        if (closed) status.textContent = `${closed} closed.`;
        input.clear();
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
    document.querySelector("#save").addEventListener(
      "click",
      () => {
        commitSave(state, localStorage).then((r) => {
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
      // The step callback owns the input sample; the render callback below needs to know
      // whether the player is reading a sense line without reaching out of scope.
      senseHeld = false;
    const loop = new Loop(
      (dt) => {
        const controls = input.sample(),
          world = rig.movement(controls.x, controls.z);
        senseHeld = !!controls.sense;
        const action = placeAction(state.place, body);
        document.querySelector("#interact").hidden = !action;
        document.querySelector("#interact").textContent =
          {
            enter: "Enter basin · R",
            leave: "Leave basin · R",
            rest: "Rest five minutes · R",
            record: "Enter the Deep Record · R",
            "record-exit": "Return to the basin · R",
          }[action] || "";
        if (controls.interact && !interactionHeld && action) {
          if (action === "rest") {
            advanceOffline(state, 300);
            body.vx = 0;
            body.vy = 0;
            body.vz = 0;
            input.clear();
            const r = save(state, localStorage);
            status.textContent = r.ok
              ? "Five quiet minutes. The watershed continued while you rested."
              : r.message;
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
          if (ledger.inBank) strataHold = { band: -1, depth: null, held: 0 };
          else if (
            strataHold.band === ledger.layer &&
            strataHold.depth === ledger.depth
          )
            strataHold.held += dt;
          else
            strataHold = { band: ledger.layer, depth: ledger.depth, held: 0 };
          if (
            !ledger.inBank &&
            strataHold.held > 1.2 &&
            state.memory.markStrata(ledger.layer, ledger.layers)
          )
            strataLoggedAt = state.elapsed;
          status.textContent =
            record.describe(body.y) +
            (state.elapsed - strataLoggedAt < 2.5
              ? " This band is logged."
              : "");
          renderRecordReadout(ledger);
        } else {
          applyWaterJet(state.watershed, body, dt);
          applyWorldJet(state.frontier, body, dt);
        }
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
        if (state.place === "frontier") effects.update(state, body);
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
        }
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
        creature.present(body, dt);
        if (state.place === "frontier")
          scenery.update(body, dt, state.waterLevel);
        audio.update(body, Settings.values);
        saveTime += dt;
        if (saveTime >= 30) {
          saveTime = 0;
          commitSave(state, localStorage).then((r) => {
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
        const underwater =
          camera.position.y < (state.place === "lab" ? -0.2 : 0) &&
          (state.place === "record"
            ? recordRegion
            : state.place === "lab"
              ? labRegion
              : liveRegion
          ).water(camera.position.x, camera.position.z, state.waterLevel);
        scene.fog.color.set(
          underwater
            ? "#246c69"
            : state.place !== "frontier"
              ? "#597b76"
              : "#9bb9aa",
        );
        scene.fog.density = underwater
          ? 0.13
          : 0.025 + state.frontier.weather.rain * 0.015;
        sun.intensity = 2.4 - state.frontier.weather.rain * 0.9;
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
            status.textContent = `Render scale ${Math.round(
              adaptive.value * 100,
            )}%.`;
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
          commitSave(state, localStorage).then((r) => {
            if (!r.ok) status.textContent = r.message;
          });
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
      adaptive,
      enterPlace,
      habitat,
      wildlife,
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
