# OPERATIONAL_STATE

project_id: squirtle-frontier
project_name: Squirtle Frontier
revision: 16
status: Early causal slice including Lab/offline return / approval gates waived / full game incomplete

## Purpose

Build a third-person systemic open-world browser game in which the player directly controls Squirtle.

The project combines:

- `westkitty/The_Living_Frontier` as the primary technical and systemic foundation.
- `westkitty/Squirtle_Lab` as the source of Squirtle-specific asset, interaction, habitat, camera, presentation, and creature-scale design requirements.

## Source authority

1. This repository's current `OPERATIONAL_STATE.md`.
2. `docs/SQUIRTLE_FRONTIER_BUILD_GUIDE.md`.
3. `docs/LM_ARENA_MASTER_BUILD_PROMPT.md`.
4. Verified current state of `westkitty/The_Living_Frontier`.
5. Verified current state of `westkitty/Squirtle_Lab`.
6. Evidence produced by tests, browser runs, screenshots, performance probes, and asset validation.

Do not mutate either source repository while building this project unless the user separately authorizes it.

## Design thesis

The player is Squirtle, not a trainer.

The frontier is large, persistent, ecological, and indifferent. Squirtle experiences it at creature scale. Water is simultaneously locomotion, navigation, sensory information, ecological infrastructure, and the primary means by which the player can understand and repair the world.

The emotional target is awe through causal depth: the player returns to places and discovers that ecosystems, settlements, watercourses, trails, wildlife, and the Lab changed because of earlier actions.

## Architectural decision

Use The Living Frontier as the primary engine substrate rather than expanding Squirtle Lab into an open-world engine.

Preserve or adapt from The Living Frontier:

- deterministic world generation;
- streamed terrain chunks and LOD;
- world-state ownership;
- ecology and abstract distant simulation;
- weather;
- fire;
- settlements and factions;
- cartography and ground memory;
- offline fast-forward;
- persistence and recovery;
- asset lifecycle;
- procedural audio;
- performance probes;
- semantic DOM UI and touch support.

Adapt from Squirtle Lab:

- Squirtle runtime asset and provenance;
- creature-first camera/framing;
- body-specific interaction vocabulary;
- behavioral memory;
- habitat/Lab design;
- photo/observation ideas;
- accessibility and responsive interaction;
- character animation and material handling;
- close-range tactile presentation.

## Hard invariants

- The playable avatar is Squirtle.
- Do not add a trainer/player-human avatar.
- Do not turn Squirtle into a spell hotbar or generic character controller.
- Movement must be body-specific: land locomotion, swimming/diving, shell slide, and water-jet propulsion must feel materially different.
- Water simulation must be layered/semantic; do not implement global physically accurate fluid simulation.
- Large-scale erosion must be staged/state-driven; do not implement global destructible voxel terrain.
- Distant ecology remains aggregate simulation. Promote only important nearby actors to persistent individual identity.
- Simulation scale and rendering scale must remain separate.
- Squirtle-specific IP must stay behind a `PlayableCreature`/presentation boundary so the underlying game can support a clean original-character build later.
- Runtime assets should be self-hosted.
- No force push or history rewrite.
- Do not claim performance, mobile viability, asset validity, visual QA, deployment, or gameplay feel without evidence.

## Prototype gate

Before broad production expansion, prove one representative watershed slice with:

- one small streamed region;
- Squirtle land/swim/dive/shell-slide/water-jet locomotion;
- creature-scale camera;
- one settlement;
- one stream/pond/cave network;
- one predator/prey chain;
- weather and fire;
- Current Sense;
- one repairable hydrology problem;
- persistent ecological propagation;
- one Lab habitat linked to frontier state;
- one offline fast-forward return;
- one Deep Record chamber;
- desktop and mobile-class performance evidence.

Production expansion is blocked until the slice demonstrates:

1. Squirtle movement is pleasurable without objectives.
2. Semantic hydrology convincingly drives visible local water behavior.
3. Streaming remains stable with creature-scale microgeometry.
4. Upstream changes propagate through ecology and visibly alter both frontier and Lab.
5. Save/load and offline fast-forward preserve that causal chain.

## Performance principles

- Keep one authoritative simulation/update loop.
- Fixed-step gameplay/world simulation where deterministic behavior matters.
- Chunk streaming and aggressive LOD.
- Instanced vegetation and batched effects.
- Pooled particles and bounded active actor counts.
- Near actors = scene objects; distant populations = data.
- Persistent Squirtle asset remains cached across traversal and Lab transitions.
- Lab and frontier must not remain simultaneously fully rendered.
- Measure memory and renderer resource counts across repeated chunk/scene transitions.
- Prefer stable 60 fps desktop and stable 30 fps mobile-class baseline over decorative excess.

## Current verified state (supersedes historical checkpoints below)

- Branch `arena/01a0f3be-squirtle-frontier`; source repositories remain read-only. Previously pushed rest/causal slice: `ad926ed`.
- Direct Squirtle control, cached GLB and one authoritative loop retained. Body updates at 60 Hz; regional hydrology/ecology/weather/fire use integer one-second ticks, identical during bounded offline return.
- Authored spring/landslide/wetland/outlet graph plus optional spring-to-outlet diversion. Nearby aimed Jet initiates the side groove, whose short local path descends sampled terrain. Diversion improves blocked-outlet supply but takes water from wetland after full repair. The side groove now reconstructs staged terrain vertices and body/camera contact from the saved stage; the wider graph is not a full generated watershed network.
- Deterministic weather drives source supply, bounded 4x4 fire spread/fuel/ash/wetness and ash runoff. Jet suppresses nearby fire. Rain/fire/channel presentation uses two extra shared geometries and fixed instance limits. No global fluid or continuous erosion.
- Player-only surveyed cells/landmarks, bounded 90-sample regional history, and one Lab frog identity/familiarity/fear persist. Offline time does not discover map cells or create encounters. Visitor mesh reacts simply to familiarity/fear; full AI and named settlement behavior remain pending.
- Deep Record reached from the submerged Lab centre (R), then Q/E to descend/ascend through eight seeded aggregate historical strata; exit near surface. Lab/Record/frontier are mutually rendered, exterior chunks unload, shared Squirtle stays cached. Record reload resumes at surface; full body-pose persistence remains pending.
- Version 5 save migrates versions 1–4; includes graph, regional fields, memory, location and wall clock. Six-hour offline cap, rollback handling, ordinary stale-tab conflict detection. Settings provide stored-save export, validated confirmed import and explicit backup recovery; replacements preserve prior bytes in one quarantine slot. Atomic multi-tab transactions were pending at that checkpoint; the save-integrity checkpoint below closes them for same-browser tabs.
- 58 automated source/behavior tests pass. Production build passes with large bundle warning (~627 kB). Movement, repair, habitat, new world and recovery browser journeys executed. World journey: keyboard bypass, fire suppression, map, dive/ascent, 12 Record/Lab cycles and zero-resource teardown. Setup teleports/seeded conditions are explicit test fixtures, not claims of entirely walked playthroughs.
- Frontier geometry bound <=23; ordinary run 22 geometries / six textures / 35 calls. Software median ~133 ms high / ~83 ms low, p95 ~317 / ~167 ms at 960x640: FPS target NOT met here; hardware/mobile performance unknown.
- Opened Deep Record, fire, map, marked-visitor and touch-settings screenshots. Found and repaired mobile nav/title overlap. Caption/controls visible, world remains crude geometry; marked visitor was partly occluded by avatar in captured pose, not a complete visual acceptance.
- Keyboard-focus regression exposed by Memory panel repaired: canvas is focusable and receives focus on pointer interaction. Escape dismisses panels, opening one closes others, repeated keydown does not retrigger rest, touch clear releases captures/resets stick.
- User waived approval gates; human enjoyment, audio, real touch usability and device performance remain unverified, NOT passed. No public deployment claimed.

## Remaining scope / completion truth

Full project NOT finished. Major remaining work: world-scale terrain-derived watershed/alternate route topology, broader terrain/collision integration, traversable micro-route network, production wildlife/settlement behavior, richer Lab play, polished/accessible presentation and controls, robust concurrent storage, measured hardware FPS, asset/legal review for distribution, and full end-to-end causal/human QA. Current systems are bounded foundations, not sufficient evidence to claim excellent movement or final production completion.

Evidence: `docs/qa/WORLD_SYSTEMS.md`, `docs/qa/world-browser.json`, `docs/qa/HABITAT_RETURN.md`, `docs/qa/habitat-browser.json`, performance and historical asset evidence.

## Historical checkpoints

The entries below record earlier scope and blockers. Current verified state and explicit user authorization supersede them.

## Phase 1 bounded repair checkpoint

- Downhill grounded contact and slide entry now prevent repeated landing/tap impulses; cliff and intentional launch regression tests pass.
- Camera constrains the final smoothed boom against terrain and inflated finite-height obstacle cylinders; orbit/recovery tests at 30/60/120 Hz pass. Both look axes respect sensitivity.
- MSAA disabled; explicit render-pixel budgets added. See `docs/performance/RENDER_DIAGNOSTIC.md`; software performance still fails the target. No further speculative optimization pass or Phase 2 expansion authorized by this evidence.
- Re-ran 20 tests, production build (bundle warning persists), physical browser journey, 12 chunk returns, 30 asset cycles, touch cancellation and full teardown. Bank, portrait touch and underwater screenshots opened after repair: character and controls readable; low detail visibly softer. No human feel/audio acceptance inferred.
- External blocker unchanged: ten-minute objective-free human playtest, heard audio and real touch usability, representative hardware GPU/mobile timing. Phase 1 gate remains open; project is NOT finished.

## User-authorized progression — 2026-09-30

User explicitly requested continued implementation and to skip gates. Approval gates are waived for progression, NOT passed or verified. Earlier statements blocking Phase 2 are superseded by this authorization; evidence discipline and architecture remain in force.

Phase 2 has started with a small authored semantic DAG (spring → landslide → wetland → outlet), bounded flow, blockage, wetness, transported sediment/contamination and time/soil/slope/vegetation-driven channel stages. WorldState advances it through the existing authoritative loop. Version 2 saves include graph/scalars; version 1 position saves migrate. Invalid topology/scalars reject before changing live state.

24 tests, production build and existing browser movement/save/lifecycle journey pass. Build still warns about bundle size. These tests verify a simulation foundation, not a complete hydrology gameplay slice. Terrain-derived topology, physical debris interaction, alternate route, Current Sense, state-driven water rendering and downstream ecological/Lab consumers remain to implement. Existing pond rendering/current remains a movement fixture and does not yet read this graph. No new visual acceptance claimed.

## Playable hydrology connection — 2026-09-30

- Nearby, aimed active Water Jet reduces saved blockage. Wetland graph flow now scales the pond current; wetness changes water tint/opacity. Fixed-size debris instances disappear as blockage clears. This is a rudimentary authored pond presentation, not a natural terrain-derived channel network.
- Hold F / touch Sense while touching water to read the actual blockage signal and show an amber ripple at the disturbance. No arbitrary quest completion flag.
- 25 tests, build, full movement browser journey, 12 chunk returns/30 asset cycles, and full zero-resource teardown pass. Added focused browser exercise for Sense, keyboard-driven repair and graph reload (setup position explicitly teleported). Initial persistence assertion sampled during a still-active jet; corrected test to wait for jet expiry, rerun passed.
- Resource bound increases by exactly two owned geometries to 18. Measured sample: 17 geometries, six textures, 27 calls; software median ~133 ms high / ~83 ms low, still not hardware evidence or acceptable FPS.
- Opened portrait touch and Sense screenshots: controls/ripple readable; debris remains crude geometric placeholder presentation and does not yet have a collision proxy. No natural-channel visual acceptance.
- Remaining: alternate channel and terrain-driven topology/staged geometry, ecological consumers, settlement, Lab, offline recovery, Deep Record, broader world production and final polish. Approval gates remain waived; completion is not claimed.

## Lab rest follow-up

R/contextual button near the wooden platform advances the existing regional simulation by five minutes and saves, only once per press. No resource/quest reward is injected. Focused spatial eligibility and browser keyboard rest tests pass; repeated held-action fast-forward is rejected by the edge latch. The same habitat test covers twelve scene transitions and zero-resource teardown afterward. Full world completion is still not claimed.

## Staged channel terrain checkpoint

- Added pure local channel-height reconstruction from five saved erosion stages; source path remains derived once from immutable base terrain. Body/camera samples and chunk vertices share this height source. Water strip follows carved route as a connected mesh.
- Streaming automatically detects stage changes (including initial Jet, rest/offline and load), invalidates only overlapping chunks and raises that chunk's grid to 128 segments while the channel is active. Unrelated chunks remain unchanged. This adds triangles, not new geometry ownership; still <=23 total geometries.
- 47 checks pass; build passes with bundle warning. Existing movement browser passes. New channel browser validates staged vertices, persistence and twelve Lab/frontier returns with zero-resource teardown. Stage-4 measurement at 960x640 SwiftShader ~133 ms median / ~250 ms p95, ~55k triangles in sampled view. Performance target still not met.
- Initial screenshot showed disconnected water patches from a coarse grid and horizontal strips. One visual repair pass densified only the affected chunk and replaced patches with a sloped connected strip; re-opened screenshot shows continuous course. Underlying continuous collision height and interpolated render triangles can still differ slightly between vertices; natural visual acceptance remains pending.
- Environment had reverted local Git HEAD to initial state while files remained; recovered already-pushed branch index/HEAD from remote without modifying files or creating duplicate commits.
- Full project completion remains unclaimed; no gate waiver is interpreted as verified quality.

## Wildlife and settlement behavior checkpoint

- Added near-only semantic actors: at most twelve prey and three predators within 28m of the wetland. Prey forage/flee/evade; predators stalk/watch/evade. Obstacle separation and deterministic frame-start decisions replace the exterior circular-orbit presentation. Distant ecology remains the existing scalar integrator; local pursuit is deliberately not a second kill/population model. Actors clear on region exit and are not serialized.
- Water house now remembers calm familiarity, fear and distinct visits. Water reliability changes caretaker target/gesture; alarming movement causes withdrawal. A familiar, sufficiently supplied settlement fills a small bowl by drawing from cistern volume. Offline ticks never award familiarity or visits. Save v5 validates settlement state; old saves start with neutral settlement memory.
- Meshes reuse existing sphere/box/cylinder geometry. Conservative house/trough collision proxies added; tree generation reserves 5m around the house. Additional materials/draw calls but no increased geometry ownership bound.
- 52 checks and production build pass (~636 kB bundle warning). Movement and habitat browser suites pass. New wildlife browser verifies stalk/evade, bowl allocation, familiarity reload, twelve Lab/frontier cycles, actor removal and zero-resource teardown. Fixture populations and history are explicitly injected, not a full player-made ecological chain.
- Current ordinary-bank SwiftShader sample median ~117 ms high / ~67 ms low, p95 200 / ~133 ms; 22 geometries, six textures, 40 calls. Targets still not met; hardware unknown.
- Opened wildlife and settlement screenshots: animals have recognizable multipart silhouettes, but are still primitive and lack full locomotion/contact animation. Settlement screenshot is obstructed by rock/tree scenery; not a final readable presentation pass.
- Known remaining limitations: no local capture/death model, no multi-step route planning, no human dialogue/complex settlement economy, and full production visual/accessibility/performance acceptance still outstanding. Full project NOT complete.

## Accessibility, adaptive resolution and built-bundle checkpoint

- Adaptive resolution added (renderer-only, 60-frame windows, 0.55–1.0 scale, cooldown, persisted opt-out); zero-count instance batches are hidden, cutting calls 40 to 39 at unchanged geometry ownership. Software A/B: median 116.6 to 100.0 ms with an 816x544 buffer and identical CSS layout; p95 unchanged in that sample. Not a hardware or mobile result; 60/30 fps still not demonstrated anywhere.
- Motion preference fixed to tri-state and applied live (it previously only took effect on reload). Preference clamping no longer resets deliberate extremes. Canvas is focusable with a 3px ring; panels announce, focus on open, refresh immediately, and Escape restores the world with correct `aria-expanded`. Survey SVG capped so panel text stays visible. Input tolerates non-element event targets and failed pointer capture.
- New `browser:a11y` (names, composited contrast 11.22 desktop / 5.15 touch lowest, 10-stop Tab walk, per-panel keyboard open/announce/close, reduced motion from OS and in game, adaptive toggle, touch targets, real CDP finger-drag stick with clean release, keyboard-only movement) and `browser:dist` (static `dist` build boots, moves, saves, reloads, one cached asset, zero teardown resources, no dev module graph). Evidence: `docs/qa/ACCESSIBILITY_PERFORMANCE.md`, `docs/qa/accessibility-browser.json`, `docs/qa/dist-browser.json`.
- Screenshot inspection led to two repairs: the panel text was clipped by a full-width SVG map, and the settlement caretaker read as detached limbs. Both re-inspected and improved; art remains provisional.
- Still open for “finished”: production wildlife/settlement depth, broader traversal and route topology, richer Lab play, authored terrain art, real screen-reader and device validation, hardware frame-rate evidence, asset/legal review for distribution, and full human QA (same-browser multi-tab storage is now covered; cross-device sync is out of scope). Full project NOT complete; waived gates are not evidence of quality.

## Save integrity and pose-resume checkpoint

- Save version 6 records a place-scoped body pose (x, y, z, yaw) alongside the legacy x/z player field and `frontierReturn`. On boot or adoption the body resumes from the pose when it belongs to the saved place, with support state re-derived by running the real physics step for up to 0.4 s; a saved mode/grounded flag is never trusted. Out-of-range or non-finite poses reject the save atomically (previous live state untouched); versions 1–5 migrate with no pose and keep the old placement path. A submerged resume drifts upward as buoyancy reasserts, which is expected physics, not a save error.
- `commitSave`/`commitLoad`/`commitWithLock` serialize read-modify-write through `navigator.locks` (exclusive mode) when available and degrade to a direct call in Node/older browsers. Save conflict detection is unchanged in spirit: a stale tab's write is refused instead of clobbering the newer generation. New `adoptStoredWorld` lets that tab read the newer generation in place (no rewrite, no offline credit, since a visible tab was already simulating), clears the block and resumes at the adopted pose via the "Adopt the newer stored world" control in Settings.
- 61 checks pass, including new save-integrity tests for pose validation, lock serialization with a forced interleaving window inside the critical section, non-destructive conflict refusal and adoption idempotence. Production build passes (628 kB bundle warning).
- New `browser:multitab` journey in one browser context: real W-key walking, save, second tab's refused write with the conflict message, in-place adoption landing within 1.5 m of the driver's saved position, a submerged Lab dive that survives reload (place `lab`, y ≈ −0.42, mode `swim`, inside the basin radius), then threshold R to return to `frontierReturn`. `docs/qa/multitab-browser.json`. Existing movement, watershed, habitat, world, recovery (now pose-aware), channel, wildlife, a11y and dist journeys rerun green.
- Two tooling assumptions needed repair rather than the app: the recovery journey asserted resume from `player.x` and the Lab-exit step pressed R from the basin centre where no action is eligible. Both are now explicit fixtures with the pose-aware assertions.
- `npm run perf` re-run after the pose work: high 66.7 ms median (p95 150) and low 33.4 ms median (p95 100) on ANGLE SwiftShader, with the adaptive A/B moving 83.3 to 66.6 ms median at identical CSS size (816x544 buffer). Absolute medians swing run to run under shared CPU; the A/B delta is the reproducible signal, and neither figure is hardware or mobile evidence. Evidence `docs/performance/phase1-measured.json`, written by the tool.
- Still open for "finished": production wildlife/settlement depth, broader traversable route topology, richer Lab play, authored terrain/art pass, real screen-reader and device validation, hardware frame-rate evidence, asset/legal review for distribution, and full human QA. Full project NOT complete; gate waivers are not evidence of quality.

## Wildlife water-behaviour checkpoint

- Near wildlife gained a reason to move that the player can read: per-animal thirst drives prey onto any shore the world's own `water(x, z)` predicate reports as wet, gated on wetland wetness > 0.25 and `(1 - contamination) * (1 - sediment/2)` > 0.5, with 2.2 s committed drinks. A flush (jet 6 m, landing 2 m) or the water turning bad mid-drink cancels a drink rather than queueing one; below none of that, thirsty animals pace (`parched`) and the panel names the reason. Predators favour committed drinkers. Herd counts still come only from `Ecosystem`, so this is legibility, not a second population or mortality model.
- Shore discovery reuses the body/camera water authority (16 rays, 0.5 m steps to 6.5 m, cached 1 s) and every decision reads one frame-start snapshot, keeping behaviour deterministic and order-independent; the new tests pin both properties explicitly.
- Places remembered gained `drinks`: per-5 m cells where a drink was observed within 10 m, capped at 200 cells and 255 sightings, validated on restore, tolerant of saves written before the field existed (no version bump, because the nested decoder accepts its absence), and surfaced as "Drink tracks in 2 places; nearest 2 m W" plus a reason when the herd will not drink.
- 68 checks pass, including seven in `tools/wildlife-water.test.mjs`. `browser:wildlife` now runs a real-system loop: clearing landslide debris wets the shallows, drinking starts and is logged, a drinker is verified standing where `region.water` says there is water; re-blocking the spring dries it and across eight samples after the flip no new tracks are recorded. All ten journeys plus `npm run build` rerun green.
- Screenshot inspection forced two repairs in the same pass: the herd was painted the reed green and disappeared into the marsh (prey now umber, predators charcoal, basin frogs keep the reed tone under their own material), and the drink line sat under two paragraphs. A near-black frame turned out to be the fixture camera parked inside the wetland bowl at water level, not a renderer fault, so the vantage moved to the rim.
- Measured cost: 22 geometries / 6 textures / 39 calls / 31,236 triangles unchanged by the pass. SwiftShader medians 66.7 ms high, 33.4 ms low; the adaptive A/B median gain did not replicate this sample (-0.1 ms vs -16.6 ms earlier), so only its structural assertions are claimed. Hardware and mobile frame rates remain unmeasured.
- Still primitive: sphere-bodied animals share a silhouette with terrain rocks, drinking is a head dip without contact animation, thirst is session-only and unsaved, and the herd stays leashed 7 m to the reed shallows, so this is one watering place rather than migration or pathfinding. Production wildlife depth, traversable route topology, richer Lab play, authored terrain art, screen-reader and real-device validation, hardware frame-rate evidence, asset/legal review and full human QA remain open. Full project NOT complete; waived gates are not evidence of quality.
