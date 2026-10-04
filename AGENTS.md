# AGENTS.md — Squirtle Frontier Agent Operating Instructions

Durable instructions for Antigravity agents working on `westkitty/Squirtle_Frontier`. These rules govern `/goal` sessions, refactors, feature additions, and bug fixes to keep execution concise while strictly preserving working systems.

---

## 1. Protagonist & Design Thesis

- **The player IS Squirtle.** Not a trainer, not a human handler, not an abstract cursor.
- **Creature Scale:** The frontier is vast, indifferent, and experienced at Squirtle's physical height. Camera framing, collision geometry, traversal routes, and human structures must reflect creature scale.
- **No Conventional RPG Clutter:** No trainer avatars, monster-catching loops, quest checklists, or generic hotbars. Water is locomotion, sensation, ecological infrastructure, and world repair.
- **Causal Depth over Asset Sprawl:** Emotional awe comes from persistent consequences (returning to find altered watercourses, recovering vegetation, adapting settlements, colonized Lab basins), not brute asset density.

---

## 2. Source-of-Truth Hierarchy

When requirements or implementations conflict, resolve in strict authority order:

1. `OPERATIONAL_STATE.md` — Authoritative live project record, verified capabilities, and closed checkpoints.
2. `README.md` — Current operational quick-start, control bindings, and active feature summary.
3. `docs/SQUIRTLE_FRONTIER_BUILD_GUIDE.md` — Canonical staged architecture and system specifications.
4. `docs/LM_ARENA_MASTER_BUILD_PROMPT.md` — Foundational constraints and prototype gates.
5. `docs/qa/TEST_AUTHORITY.md` — Mutation testing philosophy and invariant ownership standards.
6. `docs/architecture/BASELINE.md` — Component ownership mappings, engine seams, and lifecycle boundaries.
7. `docs/performance/BASELINE.md` — Performance budgets, benchmark baselines, and stability rules.
8. `package.json` — Runnable scripts, validation commands, and pinned dependencies.

*External source repositories (`westkitty/The_Living_Frontier`, `westkitty/Squirtle_Lab`) are read-only references; never modify or push to them.*

---

## 3. Protected Architectural Invariants

Preserve existing architectural decisions unless explicit repository evidence mandates change:

- **Primary Engine Substrate:** Adapted from The Living Frontier. One authoritative simulation loop (`src/loop.js`), fixed-step physical updates at 60 Hz, regional ecology/hydrology/weather/fire at 1-second ticks.
- **PlayableCreature Presentation Seam:** Squirtle-specific presentation (`src/assets/squirtle-presentation.js`) sits behind `PlayableCreature` (`src/assets/playable-creature-adapter.js`). Physics, hydrology, and world systems must **never** reference Pokémon-specific mesh names, bone IDs, or franchise constants.
- **Mutual Scene Exclusion:** The open frontier and the interior Hydrological Lab must **never** be rendered simultaneously. Exterior chunks unload on Lab entry; Squirtle's cached runtime asset remains loaded.
- **Simulation Scale vs. Render Scale:** Distant ecology remains an aggregate numerical integrator. Near actors are instantiated scene objects with bounded population pools.
- **Semantic Hydrology & Staged Erosion:** Water simulation uses a semantic directed acyclic graph (DAG) plus local vertex/shader presentation, **never** global physical fluid particles or destructive voxel meshes.
- **Versioned Semantic Persistence:** Save state (schema version 7) serializes semantic variables and place-scoped body poses, never raw Three.js scene graphs. Out-of-bounds or non-finite poses are rejected atomically.

---

## 4. Protected Gameplay Capabilities (Strict Non-Regression)

A new change **cannot** survive by breaking verified working behavior. The following verified capabilities are protected against regression:

1. **Land Locomotion:** Responsive walk, sprint/scamper (Shift), slope alignment, grounded step handling, footstep surface audio, idle breathing/tail sway, living slumber crouch with respiration audio, and smooth recovery on wake.
2. **Wading & Shorelines:** Discrete wading offset (5 cm) and paint lift (1.5 cm) relative to dynamically derived water levels (`waterAt`), with water surface wake ripples and lapping shoreline edges.
3. **Swimming:** Distinct aquatic controller state, buoyancy equilibrium, flipper paddle strokes, tail rudder undulation, yaw-rate banking, and speed wake density.
4. **Diving & Surfacing:** Hold Q (dive) / Hold E (rise), vertical body pitch attitude following vertical velocity, depth-graded underwater audio attenuation (occluding rain/stream/fauna), and sediment/contamination particulate scaling.
5. **Shell Slide:** Hold C / Hold Shell, full extremity retraction, downhill acceleration, surface-dependent friction, banking/steering, speed-driven shell spin without mutating authoritative body yaw, impact micro-recoil, and dust trails.
6. **Water Jet Traversal & Action:** Hold Space / Hold Jet, forward propulsion impulse, underwater boost, surface launch, uphill assist, aimed debris clearance at the landslide, ash rinsing on burnt ground, fire suppression, and side-groove opening. Uses dedicated particle pool and hydrodynamic surge audio.
7. **Collision & Camera/Input:** Analytic ground heights, cached static obstacle colliders, boom smoothing, low creature-scale eye line, camera recenter (keyboard V / gamepad R3), tri-state reduced-motion support, and modal panel input suppression (Escape dismisses). Multi-modality tracking (keyboard/mouse, touch stick, standard Gamepad API).
8. **Terrain & Chunk Streaming:** 24 m chunk size, streamed LOD (128 segments on the player's groove chunk, 64 segments on the immediate ring, 32 standard), static collider ground caching, and clean chunk disposal.
9. **Watershed & Hydrology:** Semantic DAG (spring → landslide → wetland → outlet), dynamic basin water level (+0.28 / -0.05 m derived from wetness), named reach inflow network (Spring gully, South draw, Long spur, North run, Basin door run, Drainage groove), and stage-reconstructed channel terrain.
10. **Current Sense:** Hold F / Hold Sense in water or on reaches. Animates downstream flow motes along active reaches, ripples at disturbances, reports reach name and water depth, and detects real Shucker evidence without inventing false signals.
11. **Wildlife & Conspecific Ecology:** Near prey foraging/fleeing and predator stalking/ambushing (capped within 28 m); thirst-driven drinking at wet shores; same-kind separation steering. Conspecific ecology with 5 ecotypes (Freshwater, Marsh, Urban active in Stillwater; Saltwater, Deepwater system-valid but habitat-ineligible); hard cap of 3 near projected Squirtles; max 4 persistent notable conspecific memories.
12. **Human Legality & Settlement:** Caretaker response ladder (fear, drought/check-water, calm familiarity, protection, reporting beyond the reeds); cistern-fed water bowl consumption after calm visits; contextual ambient dialogue.
13. **Hydrological Lab & Deep Record:** Submerged Lab entry from western bank, 5-minute rest/fast-forward (R) with edge-latch, delayed probabilistic reed/frog colonization, flooded Deep Record shaft (22 m depth, 8 seeded strata), pure `deepTimeLedger` matching HUD `<dl>`, and strata hold-to-read logging.
14. **Persistence, Concurrency & Recovery:** Version 7 save schema with migration from v1–6; place-scoped body pose resume with physics settling; `navigator.locks` critical-section serialization; stale-tab conflict refusal with in-place adoption (`adoptStoredWorld`); backup quarantine; and bounded 6-hour offline fast-forward.

---

## 5. Performance, Allocations & Art Direction

- **Frame Pacing Targets:** Target stable 60 fps desktop / 30 fps mobile. Headless SwiftShader timing is software-browser evidence, **not** proof of physical GPU or mobile frame rates. Never claim hardware FPS without actual device measurements.
- **Zero Allocations in Hot Paths:** Never allocate temporary arrays, object literals, or spread operators inside the 60 Hz frame loop, physics update, collision test, audio graph, or particle systems. Reuse module-scoped scratch vectors, reusable buffers, and stable environment views.
- **Render Cost Discipline:** Maintain draw-call and geometry budgets (typically ~40 draw calls, ~31k–33k normal triangles, <=26 geometries). Freeze static Object3D transforms (`matrixAutoUpdate = false`). Suppress invisible instance uploads for empty or distant pools.
- **Adaptive Resolution:** Renderer-only pixel budget scaling (0.55–1.0x) under render pressure without altering CSS layout, touch coordinates, or simulation time.
- **Settled Resource Lifecycle:** Repeated chunk streaming, dive/surface cycles, and Lab/frontier transitions must settle without memory drift. Full teardown must reach exactly **0 geometries / 0 textures / 0 asset references**.
- **Art Direction & Open World:** Prefer authored composition, distinct landmarks, ecological placement, amphibious traversal, and Squirtle-scale environments over uniform procedural noise. Achieve environmental density through silhouette, instanced vegetation, and atmospheric layering rather than brute-force mesh complexity.

---

## 6. Asset Rules & Licensing Hygiene

- **Squirtle Runtime Asset:** Provenance preserved in `assets/source/squirtle/Archive.zip`. Self-hosted runtime GLB at `public/assets/runtime/squirtle/squirtle.glb` (hashed and validated via `npm run assets`).
- **External Non-Squirtle Assets:** Must have verified source provenance, permissive licenses compatible with browser redistribution, self-hosted runtime storage, and manifest tracking.
- **No Mystery Dependencies:** No remote CDN hotlinks, untracked third-party meshes, or unverified audio files.
- **Disposal Verification:** Every acquired asset handle, material clone, and instanced mesh must be explicitly released during actor despawn, scene transition, or teardown.

---

## 7. The 6-Step Implementation Loop

Antigravity must follow this disciplined loop for every code change:

```
1. Inspect       → Read targeted files and related tests completely before proposing changes.
2. Baseline      → Establish current test status and performance baseline.
3. Implement     → Make the smallest cohesive change. No speculative refactoring.
4. Focused Check → Run targeted unit tests and architecture checks.
5. Regression    → Run mutation suite and full browser journey verification.
6. Keep / Revert → If any verification fails, repair within one bounded pass or revert immediately.
```

- **Smallest Cohesive Change:** Keep edits modular and bounded. Do not rewrite surrounding functions or reformat untouched files.
- **Immediate Failure Repair:** Never accumulate further work on top of a failing test, broken journey, or leaking resource ceiling. Repair or revert immediately.
- **Prohibited Habits:** No unrelated rewrites, no rescaffolding, no speculative abstractions, no deleting working features for implementation convenience, and **never weaken existing test assertions** to make a broken change pass.

---

## 8. Validation Escalation Ladder

Execute validation using the repository's **actual scripts** from `package.json`:

| Tier | Command | Purpose |
|---|---|---|
| **Tier 1: Assets** | `npm run assets` | Validates runtime GLB integrity and manifest hashes. |
| **Tier 2: Syntax & Unit** | `npm run check` | Runs `tools/arch-check.mjs` (dead import/syntax audit) and `npm test` (`tools/*.test.mjs`, 256 checks). |
| **Tier 3: Test Authority** | `npm run mutate` | Inverts/removes 80 documented contracts in temp storage; requires named tests to kill each mutation. |
| **Tier 4: Production Build** | `npm run build` | Verifies production Vite bundle compilation without errors. |
| **Tier 5: Core Journey** | `BROWSER_BUNDLED=1 npm run browser` | **Primary protective gameplay journey:** land run → shell slide → bank water entry → swimming → dive → boost → ascent → surface launch → camera drag → settings/reduced-motion → save/reload → wet trail → 12 chunk returns → 30 asset cycles → zero teardown. |
| **Tier 6: Subsystem Journeys** | `BROWSER_BUNDLED=1 npm run <journey>` | `browser:watershed`, `browser:habitat`, `browser:world`, `browser:recovery`, `browser:channel`, `browser:wildlife`, `browser:squirtles`, `browser:a11y`, `browser:gamepad`, `browser:multitab`. |
| **Tier 7: Performance & Stability** | `BROWSER_BUNDLED=1 npm run perf` | Measures frame times, 360-frame settled stability, chunk cycling, adaptive A/B, and zero teardown. |
| **Tier 8: Visual Geometry** | `node tools/shoreline-capture.mjs` | Verifies physical 1.50 m shoreline movement between low and full water levels. |
| **Tier 9: Built Bundle Proof** | `BROWSER_BUNDLED=1 npm run browser:dist` | Boots and verifies static production `dist/` bundle with real movement, persistence, and teardown. |

*Browser runs require an active dev server (`npm run start` or running on port 5173) or using the bundled Chromium launcher (`BROWSER_BUNDLED=1`).*

---

## 9. Evidence Discipline & Status Declarations

Never invent success or report unexecuted validations. Explicitly distinguish states:

- **`VERIFIED`**: Proven by an executed test, automated browser journey log, or captured screenshot.
- **`IMPLEMENTED_UNVERIFIED_IN_RUNTIME`**: Code is written and compiles/passes static checks, but browser execution or live performance has not yet run in this session.
- **`BROKEN`**: A test, mutation check, build step, or assertion failed. Requires immediate repair or revert.
- **`UNKNOWN`**: Hardware GPU frame rate, physical mobile touch feel, human gameplay enjoyment, and heard audio. Always declare these as unverified when testing in headless/software environments.

---

## 10. Git, Workflow Safety & Completion Reporting

- **Permission Boundary:** **Do NOT stage, commit, push, merge, deploy, or publish unless the current user request explicitly authorizes it.**
- **History Protection:** Never run `git init`, `git reset --hard`, `git clean -fd`, force-push, or rewrite git history.
- **Concise Completion Report:** End every active session with a crisp summary containing:
  1. **Retained Gains:** What was implemented or improved.
  2. **Files Inspected & Changed:** Exact relative file paths.
  3. **Validation Evidence:** Commands run, tests passed, mutation score, and journey results.
  4. **Regressions & Unverified Scope:** Known limitations, unmeasured hardware states, or remaining open gates.
  5. **Decisive Next Action:** Exactly ONE recommended logical next step.
