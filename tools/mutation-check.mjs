// A suite that passes under a rule and under its negation is not a test of the rule. That is
// how one defect in this project shipped: the loop kept an older hold rule, 105 checks stayed
// green, and only a read of the diff noticed. So this runs the unit suite against each
// deliberately broken source file and requires the break to be *named* by a failing test.
//
// Every mutation is a single textual swap that keeps the file syntactically valid: a kill by
// parse error would prove the suite runs, not that it understands. Survivors are gaps in the
// tests, not in the code, and each one is a to-do.
//
// The repository is never written to. A scratch copy of the sources is broken instead, so an
// interrupted, crashed or ctrl-C-ed run cannot leave a mutated file in the working tree - a
// first version of this tool tried to restore in place and could not survive a signal
// arriving inside the synchronous suite call.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const MUTATIONS = [
  {
    what: "Stillwater invents saltwater/deepwater habitat",
    file: "src/simulation/squirtle-ecology.js",
    from: "    this.suitability.saltwater = 0;\n    this.suitability.deepwater = 0;",
    to: "    this.suitability.saltwater = 1;\n    this.suitability.deepwater = 1;",
  },
  {
    what: "Shucker pressure no longer makes viable habitat unsafe",
    file: "src/simulation/squirtle-ecology.js",
    from: "this.shuckerPressure * 0.78",
    to: "this.shuckerPressure * 0",
  },
  {
    what: "nearby Squirtles lose their hard three-actor cap",
    file: "src/simulation/near-squirtles.js",
    from: "export const MAX_NEAR_CONSPECIFICS = 3;",
    to: "export const MAX_NEAR_CONSPECIFICS = 30;",
  },
  {
    what: "Current Sense invents Shucker evidence without Shucker state",
    file: "src/simulation/squirtle-ecology.js",
    from: "    if (this.shuckerPressure < 0.35 || this.shuckerTicks <= 0) return null;",
    to: "    if (false) return null;",
  },
  {
    what: "notable Squirtle memory loses its hard storage bound",
    file: "src/simulation/place-memory.js",
    from: "      if (this.squirtles.length >= MAX_NOTABLE_CONSPECIFICS) return null;",
    to: "      if (false) return null;",
  },
  {
    what: "ordinary humans universally report rather than ignore strangers",
    file: "src/simulation/settlement.js",
    from: '    if (this.visits === 0 && !this.present) return "ignore";',
    to: '    if (this.visits === 0 && !this.present) return "report";',
  },
  {
    what: "the new save schema stays on version six",
    file: "src/worldstate.js",
    from: "    this.version = 7;",
    to: "    this.version = 6;",
  },
  {
    what: "offline and active regional ticks stop advancing conspecific ecology",
    file: "src/worldstate.js",
    from: "      this.squirtleEcology.tick(this.watershed, this.ecosystem, this.settlement);",
    to: "      void this.squirtleEcology;",
  },
  {
    what: "real Shucker pressure stops surfacing as a world transition",
    file: "src/presentation-signals.js",
    from: "  if (previous.shucker !== next.shucker) {",
    to: "  if (false && previous.shucker !== next.shucker) {",
  },
  {
    what: "remembered Squirtle ecology disappears from the memory summary",
    file: "src/presentation-signals.js",
    from: "  return \`${signs}${remembered}${missing}${threat}\`;",
    to: "  return \\"Squirtle signs are unavailable.\\";",
  },
  {
    what: "protective caretaker legality collapses back to generic welcome",
    file: "src/simulation/settlement.js",
    from: "  if (legal === \\"protect\\")",
    to: "  if (false && legal === \\"protect\\")",
  },
  {
    what: "depth leaf keeps two decimals while the screen shows one",
    file: "src/simulation/deep-history.js",
    from: "depth: +finite(depth).toFixed(1),",
    to: "depth: +finite(depth).toFixed(2),",
  },
  {
    what: "cut share rounded again in presentation instead of measurement",
    file: "src/simulation/deep-history.js",
    from: "cutShare: +((cutMetres * 100) / RECORD_DEPTH).toFixed(1),",
    to: "cutShare: +((cutMetres * 100) / RECORD_DEPTH).toFixed(2),",
  },
  {
    what: "the bank above the first band is claimed as a stratum",
    file: "src/simulation/deep-history.js",
    from: "    inBank,\n    bankAbove:",
    to: "    inBank: false,\n    bankAbove:",
  },
  {
    what: "every layer gets a constant thickness, so the last stops short of the floor",
    file: "src/simulation/deep-history.js",
    from: "return +((next ? next.depth : RECORD_DEPTH) - era.depth).toFixed(6);",
    to: "return +(2.3).toFixed(6);",
  },
  {
    what: "the hold counts only while the body is moving",
    file: "src/simulation/deep-history.js",
    from: "steady = Number.isFinite(vy) && Math.abs(vy) <= STRATA_SETTLE_SPEED;",
    to: "steady = Number.isFinite(vy) && Math.abs(vy) >= STRATA_SETTLE_SPEED;",
  },
  {
    what: "a hold carried from one band to the next",
    file: "src/simulation/deep-history.js",
    from: "if (hold?.band !== band) return { band, held: 0 };",
    to: "if (false) return { band, held: 0 };",
  },
  {
    what: "logging a band twice counts twice",
    file: "src/simulation/place-memory.js",
    from: "this.strata.includes(index)",
    to: "false",
  },
  {
    what: "a saved strata list is trusted without bounds",
    file: "src/simulation/place-memory.js",
    from: "          (n) => !Number.isInteger(n) || n < 0 || n > RECORD_BANDS - 1,",
    to: "          (n) => !Number.isInteger(n),",
  },
  {
    what: "remembered reaches may repeat",
    file: "src/simulation/place-memory.js",
    from: "        !this.reaches.includes(reach.id) &&",
    to: "        true &&",
  },
  {
    what: "drink tracks are recorded from anywhere in the watershed",
    file: "src/simulation/place-memory.js",
    from: "if (Math.hypot(site.x - body.x, site.z - body.z) > 10) continue;",
    to: "if (false) continue;",
  },
  {
    what: "the basin level is anchored on the wrong wetland supply",
    file: "src/simulation/water-level.js",
    from: "export const WETLAND_PRISTINE = 0.05;",
    to: "export const WETLAND_PRISTINE = 0.06;",
  },
  {
    what: "the painted shallows sit at the surface instead of above it",
    file: "src/simulation/water-level.js",
    from: "export const WATER_PAINT_LIFT = 0.015;",
    to: "export const WATER_PAINT_LIFT = 0.05;",
  },
  {
    what: "the painted shallows flood the walkable rim the body stands on",
    file: "src/player/movement-region.js",
    from: "heightAt(x, z) < WATER_SHORELINE(level)",
    to: "heightAt(x, z) < level",
  },
  {
    what: "the shaft floor constant drifts from the geometry that uses it",
    file: "src/simulation/deep-history.js",
    from: "export const RECORD_DEPTH = 22;",
    to: "export const RECORD_DEPTH = 21;",
  },
  {
    what: "the basin colonises with no water, reeds, insects or prey",
    file: "src/simulation/ecosystem.js",
    from:
      "    const eligible =\n      this.labWater > 0.5 &&\n      this.labReeds > 0.35 &&\n      this.labInsects > 0.25 &&\n      this.prey > 0.2;",
    to: "    const eligible = true;",
  },
  {
    what: "a lapse in eligibility keeps the colonisation clock",
    file: "src/simulation/ecosystem.js",
    from:
      "    this.eligibleSeconds = eligible\n      ? Math.min(3600, this.eligibleSeconds + 1)\n      : 0;",
    to:
      "    this.eligibleSeconds = eligible\n      ? Math.min(3600, this.eligibleSeconds + 1)\n      : this.eligibleSeconds;",
  },
  {
    what: "frogs arrive the moment the basin exists, not after sustained eligibility",
    file: "src/simulation/ecosystem.js",
    from: "    const arrival = 120 + (this.seed % 61);",
    to: "    const arrival = 0;",
  },
  {
    what: "the caretaker's water sense is a wish, not the cistern",
    file: "src/simulation/settlement.js",
    from:
      "    this.waterReliability +=\n      (ecosystem.cistern - this.waterReliability) * (1 - Math.exp(-1 / 120));",
    to: "    this.waterReliability = 1;",
  },
  {
    what: "the bowl is filled from nothing instead of consuming cistern volume",
    file: "src/simulation/settlement.js",
    from: "      ecosystem.cistern -= refill * 0.002;",
    to: "      ecosystem.cistern -= 0;",
  },
  {
    what: "the herd drinks from fouled or dried shallows",
    file: "src/simulation/near-wildlife.js",
    from:
      "    const drinkable =\n      !!this.sites.length && quality > 0.5 && (water?.wetness ?? 1) > 0.25;",
    to: "    const drinkable = !!this.sites.length;",
  },
  {
    what: "stationary idle freezes into a bind-pose statue without breathing",
    file: "src/assets/squirtle-presentation.js",
    from: "        const breath = Math.sin(this.breathPhase);",
    to: "        const breath = 0;",
  },
  {
    what: "aquatic swimming repeats land gait without flipper strokes",
    file: "src/assets/squirtle-presentation.js",
    from: "    this.swimPhase += dt * (aquatic ? (isMoving ? 6.2 : 2.5) : 0);",
    to: "    this.swimPhase = 0;",
  },
  {
    what: "water exit fails to trigger an emergent shake-off",
    file: "src/assets/squirtle-presentation.js",
    from:
      "    if (this.wasAquatic && !aquatic && b.grounded) {\n      this.shakeTime = 0.6;\n    }",
    to: "    if (false) {\n      this.shakeTime = 0.6;\n    }",
  },
  {
    what: "attention targets behind Squirtle outside field of view are attended anyway",
    file: "src/player/creature-attention.js",
    from: "    if (distH > OMNI_PROXIMITY && yawDiff > ATTENTION_FOV) return;",
    to: "    if (false) return;",
  },
  {
    what: "gaze yaw ignores anatomical clamp and exceeds limits",
    file: "src/assets/squirtle-presentation.js",
    from: "      const clampedYaw = Math.max(-0.85, Math.min(0.85, rawYawDiff));",
    to: "      const clampedYaw = rawYawDiff;",
  },
  {
    what: "shell slide tracks attention targets instead of retracting head",
    file: "src/assets/squirtle-presentation.js",
    from:
      "    if (inShell || this.restProgress > 0.45) {\n      // Complete suppression in shell slide or peaceful slumber\n      this.lookYaw = 0;\n      this.lookPitch = 0;\n      this.attentionTime = 0;\n      this.activeAttention = null;\n    }",
    to:
      "    if (false) {\n      this.lookYaw = 0;\n      this.lookPitch = 0;\n      this.attentionTime = 0;\n      this.activeAttention = null;\n    }",
  },
  {
    what: "undisturbed idle stays standing upright instead of settling into slumber crouch",
    file: "src/assets/squirtle-presentation.js",
    from:
      "    const isResting =\n      (b.resting || this.idleTime > 5.5) &&\n      b.grounded &&\n      !inShell &&\n      !aquatic &&\n      !isMoving;",
    to:
      "    const isResting = false;",
  },
  {
    what: "water jet fails to activate hydrodynamic surge on jet voice",
    file: "src/audio.js",
    from: "    const jetLevel = body.jetTime > 0 ? 0.38 : 0;",
    to: "    const jetLevel = 0;",
  },
  {
    what: "dive mode fails to activate submerged cavern sub-drone",
    file: "src/audio.js",
    from:
      "    const subLevel = body.mode === \"dive\" ? 0.12 + depth * 0.18 : 0;",
    to: "    const subLevel = 0;",
  },
  {
    what: "submerged resonance ignores actual depth below the surface",
    file: "src/audio.js",
    from:
      "    const subLevel = body.mode === \"dive\" ? 0.12 + depth * 0.18 : 0;",
    to: "    const subLevel = body.mode === \"dive\" ? 0.3 : 0;",
  },
  {
    what: "tree canopy fails to soften rain acoustics",
    file: "src/audio.js",
    from: "      canopyRain = 1 - canopy * 0.55,",
    to: "      canopyRain = 1,",
  },
  {
    what: "attention drops its current fixation for a negligible challenger",
    file: "src/player/creature-attention.js",
    from: "      if (score(held) >= score(best) - margin) best = held;",
    to: "      if (false) best = held;",
  },
  {
    what: "nearby herd agents do not steer apart from same-kind neighbours",
    file: "src/simulation/near-wildlife.js",
    from: "        dx += separateX * 0.9;\n        dz += separateZ * 0.9;",
    to: "        dx += 0;\n        dz += 0;",
  },
  {
    what: "water-exit wet tracks never reach the rendered trail pool",
    file: "src/player/movement-scenery.js",
    from: "    this.wetTrail.count = this.wetMarks.length;",
    to: "    this.wetTrail.count = 0;",
  },
  {
    what: "water jet fails to emit forward pressurized particle stream",
    file: "src/player/world-effects.js",
    from: "    if (body.jetTime > 0) {",
    to: "    if (false && body.jetTime > 0) {",
  },
  {
    what: "aquatic surface wake fails to generate ripples while moving through water",
    file: "src/player/world-effects.js",
    from: "    if (inWater && speed > 0.25 && body.jetTime <= 0) {",
    to: "    if (false) {",
  },
  {
    what: "Water Jet incorrectly overlaps the ordinary swim wake",
    file: "src/player/world-effects.js",
    from: "    if (inWater && speed > 0.25 && body.jetTime <= 0) {",
    to: "    if (inWater && speed > 0.25) {",
  },
  {
    what: "ordinary swimming incorrectly emits the Jet particle stream",
    file: "src/player/movement-scenery.js",
    from: "    const active = body.jetTime > 0,",
    to: "    const active = body.jetTime > 0 || body.mode === \"swim\",",
  },
  {
    what: "strangers can drink from the caretaker's bowl without familiarity",
    file: "src/simulation/place-interaction.js",
    from: "      context.settlement.familiarity >= 0.25 &&",
    to: "      context.settlement.familiarity >= 0 &&",
  },
  {
    what: "empty basin without frogs awards splash action",
    file: "src/simulation/place-interaction.js",
    from: "      context?.ecosystem?.labFrogs >= 1 &&",
    to: "      context?.ecosystem?.labFrogs >= 0 &&",
  },
  {
    what: "caretaker dialogue rejects bodies within normal speaking range",
    file: "src/simulation/settlement.js",
    from: "  if (d > 8.0) return null;",
    to: "  if (d > 0.1) return null;",
  },
  {
    what: "caretaker welcome fails to animate welcoming arm wave gesture",
    file: "src/player/habitat-view.js",
    from: "        const wave = mode === \"welcome\" ? Math.sin(time * 4.2) * 0.16 : 0;",
    to: "        const wave = 0;",
  },
  {
    what: "stream foam rapids fail to activate along running channel when stage >= 2",
    file: "src/player/world-effects.js",
    from: "    if (state.frontier.stage >= 2 && this.route.length > 1) {",
    to: "    if (false && state.frontier.stage >= 2 && this.route.length > 1) {",
  },
  {
    what: "localized stream flow acoustics fail to activate near running channel",
    file: "src/audio.js",
    from: "      contextInfo.channelStage >= 2 &&",
    to: "      contextInfo.channelStage >= 99 &&",
  },
  {
    what: "fast shell slide fails to widen camera FOV",
    file: "src/player/creature-camera.js",
    from: "      } else if (inSlide) {\n        fov = 55 + Math.min(speed, 5.0) * 1.1;\n      }",
    to: "      } else if (inSlide) {\n        fov = 55;\n      }",
  },
  {
    what: "hard body impact fails to trigger camera recoil",
    file: "src/player/creature-camera.js",
    from: "      if (body.impact > 0.04) {\n        this.impactRecoil = Math.min(0.08, body.impact * 0.12);\n      }",
    to: "      if (body.impact > 0.04) {\n        this.impactRecoil = 0;\n      }",
  },
  {
    what: "read strata fail to illuminate with mineral patina",
    file: "src/player/deep-record.js",
    from: "      } else if (isRead) {",
    to: "      } else if (false && isRead) {",
  },
  {
    what: "active strata hold fails to pulse resonance",
    file: "src/player/deep-record.js",
    from: "      if (isHolding) {",
    to: "      if (false && isHolding) {",
  },
  {
    what: "water jet fails to rinse ash from fire site",
    file: "src/simulation/water-interaction.js",
    from: "      if (frontier.ash[i] > 0)\n        frontier.ash[i] = Math.max(0, frontier.ash[i] - dt * 0.8);",
    to: "      if (false && frontier.ash[i] > 0)\n        frontier.ash[i] = Math.max(0, frontier.ash[i] - dt * 0.8);",
  },
  {
    what: "offline fast-forward fails to advance regional tick",
    file: "src/persistence.js",
    from: "  for (let i = 0; i < ticks; i++) state.update(1);",
    to: "  for (let i = 0; i < 0; i++) state.update(1);",
  },
  {
    what: "the visible shore is reported from the sample it landed on, not the crossing",
    file: "src/player/pond-surface.js",
    from: "  return lo;",
    to: "  return dry;",
  },
  {
    what: "every spoke of the pond is given one radius, so the outline stops being directional",
    file: "src/player/pond-surface.js",
    from: "    radii[s] = pondShoreRadius(isWet, (s / spokes) * Math.PI * 2, maxRadius);",
    to: "    radii[s] = pondShoreRadius(isWet, 0, maxRadius);",
  },
  {
    what: "a ray that never leaves the water invents a shoreline instead of clamping",
    file: "src/player/pond-surface.js",
    from: "  if (dry === null) return wet > 0 ? maxRadius : 0;",
    to: "  if (dry === null) return wet;",
  },
  {
    what: "the visible shore is never re-measured, so a repair moves nothing you can see",
    file: "src/player/pond-surface.js",
    from: "  return Math.abs(next - previous) >= LEVEL_EPSILON;",
    to: "  return false;",
  },
  {
    what: "a millimetre of noise rebuilds the shoreline every frame",
    file: "src/player/pond-surface.js",
    from: "  return Math.abs(next - previous) >= LEVEL_EPSILON;",
    to: "  return Math.abs(next - previous) >= 0;",
  },
  {
    what: "pond annulus triangles wind downward and flip DoubleSide lighting",
    file: "src/player/movement-scenery.js",
    from: "        indices[p++] = a;\n        indices[p++] = b;\n        indices[p++] = c;\n        indices[p++] = b;\n        indices[p++] = d;\n        indices[p++] = c;",
    to: "        indices[p++] = a;\n        indices[p++] = c;\n        indices[p++] = b;\n        indices[p++] = b;\n        indices[p++] = c;\n        indices[p++] = d;",
  },
  {
    what: "a later scale flash barges over a newer status message",
    file: "src/status-note.js",
    from: "  if (running && element.textContent !== running.wrote) return running;",
    to: "  if (false) return running;",
  },
  {
    what: "a transient notice adopts the last notice as the line it restores",
    file: "src/status-note.js",
    from: "  const restore = running ? running.restore : element.textContent;",
    to: "  const restore = element.textContent;",
  },
  {
    what: "a transient notice never hands the caption back",
    file: "src/status-note.js",
    from: "  if (element.textContent === flash.wrote) element.textContent = flash.restore;",
    to: "  if (false) element.textContent = flash.restore;",
  },
  {
    what: "a transient notice overwrites whatever spoke after it",
    file: "src/status-note.js",
    from: "  if (element.textContent === flash.wrote) element.textContent = flash.restore;",
    to: "  element.textContent = flash.restore;",
  },
  {
    what: "the shaft instrument keeps a display rule that outranks its own hidden attribute",
    file: "styles.css",
    from: "#record-readout[hidden] {\n  display: none;\n}",
    to: "#record-readout[hidden] {\n  display: block;\n}",
  },
  {
    what: "the caption goes back to a magic offset instead of the column that holds it",
    file: "styles.css",
    from: "#field-notes {\n  position: absolute;",
    to: "#field-notes {\n  position: static;",
  },
  {
    what: "living slumber crouch fails to activate respiration murmur",
    file: "src/audio.js",
    from: "    } else if (body.grounded && speed <= 0.1 && contextInfo.isSleeping) {",
    to: "    } else if (false && body.grounded && speed <= 0.1 && contextInfo.isSleeping) {",
  },
  {
    what: "body collision ignores cached static obstacle ground and resamples terrain",
    file: "src/player/squirtle-controller.js",
    from: "    const obstacleGround = Number.isFinite(o.ground)\n      ? o.ground\n      : env.sample(o.x, o.z).height;",
    to: "    const obstacleGround = env.sample(o.x, o.z).height;",
  },
  {
    what: "unchanged wildlife populations reconcile again every fixed step",
    file: "src/simulation/near-wildlife.js",
    from: "    if (prey === this.preyLimit && predators === this.predatorLimit) return;",
    to: "    if (false) return;",
  },
  {
    what: "presentation signals discard the caller's reusable output record",
    file: "src/presentation-signals.js",
    from: "export function presentationSignals(state, out = {}) {",
    to: "export function presentationSignals(state, out = {}) {\n  out = {};",
  },
  {
    what: "rain terrain cache refreshes every frame instead of reusing nearby samples",
    file: "src/player/world-effects.js",
    from: "    if (!moved && !stale && !grew) return;",
    to: "    if (false) return;",
  },
  {
    what: "canopy cover rescans streamed trees inside the same memo cell",
    file: "src/player/movement-scenery.js",
    from: "    if (key === this.canopyKey) return this.canopyValue;",
    to: "    if (false) return this.canopyValue;",
  },
  {
    what: "distant frontier wildlife still uploads invisible instance matrices",
    file: "src/player/habitat-view.js",
    from: "      if (!nearby) {",
    to: "      if (false) {",
  },
];

// What the tests can reach from their own directory: sources, tools, and the small amount of
// project data a unit test is allowed to read.
const COPIES = ["src", "tools", "assets", "docs", "prompts"];
const FILES = [
  "package.json",
  "index.html",
  "styles.css",
  "vite.config.js",
  "OPERATIONAL_STATE.md",
  "README.md",
];

// A signal can land inside the synchronous suite call, where no handler of ours can run, so a
// previous run may leave its scratch copy behind. Sweep the old ones; leave anything younger
// than an hour alone, in case a second run is legitimately in flight.
for (const stale of readdirSync(tmpdir()).filter((n) =>
  n.startsWith("sf-mutation-"),
)) {
  const path = `${tmpdir()}/${stale}`;
  if (Date.now() - statSync(path).mtimeMs > 3_600_000)
    rmSync(path, { recursive: true, force: true });
}

const work = mkdtempSync(`${tmpdir()}/sf-mutation-`);
const scratch = (file) => `${work}/${file}`;
for (const dir of COPIES)
  if (existsSync(dir)) cpSync(dir, scratch(dir), { recursive: true });
for (const file of FILES) if (existsSync(file)) cpSync(file, scratch(file));
if (existsSync("node_modules"))
  symlinkSync(resolve("node_modules"), scratch("node_modules"), "dir");
const sweep = () => rmSync(work, { recursive: true, force: true });
process.on("exit", sweep);
// Only the scratch copy is at stake, so a signal can clean up and hand the exit code back.
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    sweep();
    process.exit(128 + (signal === "SIGINT" ? 2 : 15));
  });

const testFiles = (await readdir("tools"))
  .filter((n) => n.endsWith(".test.mjs"))
  .sort();

function suite() {
  try {
    execFileSync(
      process.execPath,
      ["--test", "--test-reporter=tap", ...testFiles.map((n) => `tools/${n}`)],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], cwd: work },
    );
    return { passed: true, output: "" };
  } catch (error) {
    return {
      passed: false,
      output: `${error.stdout ?? ""}${error.stderr ?? ""}`,
    };
  }
}

if (!suite().passed) {
  console.error(
    "the unit suite must pass before its mutations can be judged; run `npm test`",
  );
  process.exit(1);
}

const pristine = new Map(),
  failures = [];
for (const mutation of MUTATIONS) {
  if (!pristine.has(mutation.file))
    pristine.set(mutation.file, readFileSync(scratch(mutation.file), "utf8"));
  const source = pristine.get(mutation.file);
  const hits = source.split(mutation.from).length - 1;
  let verdict, detail;
  if (hits !== 1) {
    verdict = "STALE ANCHOR";
    detail = `${hits} matches for the mutation's text - fix this tool, the source moved`;
    failures.push(`${mutation.what} (anchor no longer matches)`);
  } else {
    writeFileSync(
      scratch(mutation.file),
      source.replace(mutation.from, mutation.to),
    );
    const result = suite();
    writeFileSync(scratch(mutation.file), source);
    if (result.passed) {
      verdict = "SURVIVED";
      detail = "no test noticed - the suite does not own this behaviour";
      failures.push(mutation.what);
    } else {
      const named = result.output.match(/^not ok \d+ - (.*)$/m);
      const syntax = /SyntaxError|Unexpected token/.test(result.output);
      verdict = syntax ? "killed (parse only)" : "killed";
      detail = named
        ? named[1]
        : "the suite failed without naming a test; check the output";
      if (syntax)
        failures.push(`${mutation.what} (only a parse error caught it)`);
    }
  }
  console.log(
    `${verdict.padEnd(19)} ${mutation.what}\n${" ".repeat(23)}${detail}`,
  );
}
const survivors = failures.length;
console.log(
  `${MUTATIONS.length - survivors}/${MUTATIONS.length} injected defects caught by a named test.` +
    (survivors
      ? ` ${survivors} survived:\n - ${failures.join("\n - ")}`
      : " the suite currently owns every rule this list can break."),
);
if (survivors) process.exit(1);
