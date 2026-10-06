# AGENTS.md — Squirtle Frontier Agent Operating Instructions

Durable instructions for Antigravity agents working on `westkitty/Squirtle_Frontier`. These rules govern `/goal` sessions, refactors, feature additions, and bug fixes to keep execution concise while strictly preserving working systems.

---

## 1. Protagonist & Design Thesis

- **The player IS Squirtle.** Not a trainer, not a human handler, not an abstract cursor.
- **Body First:** Running, swimming, diving, shell-sliding and Water Jet are the primary product surface. Movement must be pleasurable without an objective before major feature expansion.
- **Creature Scale:** The frontier is vast, indifferent, and experienced at Squirtle's physical height. Camera framing, collision geometry, traversal routes, water entrances and human structures must reflect creature scale.
- **Encounter Over Explanation:** Other Squirtles, wildlife, humans, structures, weather and environmental events should create curiosity through visible behavior and physical cues.
- **Consequence Over Maintenance:** The world may use hydrology, ecology, settlements, fire and persistence internally, but the player is not a hydrologist. Simulation supports physical consequences; it does not assign system-maintenance homework.
- **No Conventional RPG Clutter:** No trainer avatars, monster-catching loops, quest checklists or generic hotbars.
- **Environmental Readability:** Important local conditions must be discoverable in the world. Text is reinforcement/accessibility, not the only source of truth.
- **Causal Depth over Asset Sprawl:** Emotional awe comes from returning to a place and noticing that it changed because of prior actions.

**Controlling rule:** simulation is allowed to be complicated internally. Playing Squirtle is not.

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

## 4. Protected Capabilities and Redesign Authority

A new change cannot survive by casually breaking verified infrastructure. However, the 2026-10-06 body-first redesign intentionally supersedes several old player-facing contracts. Distinguish **protected capability** from **legacy behavior scheduled to change**.

### 4.1 Protected foundations

Preserve these capabilities unless the active phase explicitly replaces them with validated equivalents:

1. **Direct Squirtle Body Authority:** One authoritative body-state controller separated from imported scene hierarchy.
2. **Land/Water Mode Coverage:** The player can locomote on land, wade/swim, dive/rise, shell-slide and use Water Jet. Exact tuning, step thresholds, friction constants, braking curves, velocity caps and transition rules are *not* protected merely because tests currently pin them.
3. **Creature Presentation Seam:** Procedural body presentation, wetness, shell retraction/spin, wake/splash/dust and asset ownership remain behind the PlayableCreature/presentation boundary.
4. **Camera/Input/Accessibility Foundation:** Low creature-scale camera, obstacle/terrain constraint, recenter, sensitivity/invert, reduced-motion support, keyboard/mouse, touch and standard Gamepad API remain supported. Exact camera behavior may be changed to remove penetration or involuntary steering.
5. **Terrain & Chunk Streaming:** Existing chunk ownership, LOD, collider caching and clean disposal remain protected while traversal composition is changed.
6. **Background World Simulation:** Weather, fire, ecology, semantic hydrology, water levels, wetness, sediment/contamination, staged channels and offline advancement remain available as background consequence machinery. Their current *player-facing diagnosis* is not protected.
7. **Wildlife & Conspecific Ecology:** Near prey/predator behavior, bounded projected Squirtles, persistent notable memories and legality/Shucker state remain protected as data/behavior foundations.
8. **Human & Settlement State:** Caretaker fear/familiarity/protection/reporting and water-dependent bowl/cistern state remain protected as consequence/encounter foundations.
9. **Lab & Deep Record:** Scene exclusion, Lab access, rest/fast-forward, basin/colonization state, Deep Record access and saved strata knowledge remain protected as optional world content.
10. **Persistence, Concurrency & Recovery:** Versioned semantic saves, migration, body-pose resume, locking/conflict handling, backup quarantine and bounded offline fast-forward remain strict non-regression areas.
11. **Resource Lifecycle and Performance Discipline:** Zero-leak teardown, hot-path allocation discipline, draw/geometry budgets and evidence honesty remain strict.

### 4.2 Explicitly superseded or redesign-authorized contracts

The following old behaviors must **not** be restored simply because historical tests or documents contain them:

- **Current Sense:** removed from keyboard/touch/gamepad controls, status text and player-facing discovery in body-first Phase 2. Do not reintroduce it, rename it, or bind its retired inputs to a substitute scanner.
- **Sense-only presentation:** the retired amber disturbance ripple, flow motes, named-reach diagnosis and Shucker/conspecific telemetry must remain absent from ordinary play.
- **Watershed-as-objective:** the player is no longer required to diagnose or repair a watershed graph. The watershed may remain authoritative internally and drive visible consequences.
- **Opening hydrology tutorial:** the landslide may remain an optional physical interaction, but it is not the required opening loop.
- **Exact Water Jet contract:** the current hold-to-pulsed-impulse/cooldown/body-yaw environmental interaction may be replaced by a clearer traversal/manipulation design.
- **Exact Shell/step tuning:** altitude-based slide friction, 0.18 m hard-step cancellation, immediate release braking and the current global speed cap are authorized for replacement when the movement phase reaches them.
- **Exact camera-relative look/movement coupling:** may be changed if human or runtime evidence shows unintended redirection.
- **Simulation telemetry in ordinary UI:** ongoing hydrology/ecology diagnostics are not protected product features.

When implementation reaches one of these areas, retire or rewrite tests/mutations that assert the superseded behavior **only after replacement coverage exists**. Never weaken tests merely to make a broken implementation pass.

### 4.3 Expansion gate

No new major gameplay subsystem, world-scale expansion, or semantic-simulation expansion may be added until the Phase 1 human movement gate passes. The five core verbs—scamper, shell, swim, dive and Jet—plus camera must be enjoyable on real hardware without objectives.

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
| **Tier 2: Syntax & Unit** | `npm run check` | Runs `tools/arch-check.mjs` (dead import/syntax audit) and `npm test` (`tools/*.test.mjs`, 268 checks). |
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
