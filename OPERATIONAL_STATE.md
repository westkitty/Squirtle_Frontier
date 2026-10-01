# OPERATIONAL_STATE

project_id: squirtle-frontier
project_name: Squirtle Frontier
revision: 24
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
- Frontier geometry bound <=23 (raised to <=24 by the named-reaches checkpoint below, to leave room for a chunk overlapping its own rebuild); ordinary run 23 geometries / six textures / 40 calls / 31,236 triangles. Software median ~67 ms high / ~50 ms low, p95 ~167 / ~83 ms at 960x640: FPS target NOT met here; hardware/mobile performance unknown. The chunk that holds a carved groove no longer forces 128 segments on its neighbours (see the chunk-detail-budget checkpoint), which cut that view 56,445 to 31,869 triangles.
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

## Named reaches checkpoint

- `src/simulation/reaches.js` reads the basin's inflows off the same `heightAt` the body walks on (sixteen candidate directions per step, descent leading, a bounded pull toward the movement region's water ellipse, stopping at the first submerged point). Routes that loop or stall are dropped instead of promised, so every named route ends in water: Spring gully 27 m, South draw 25 m, Long spur 15 m, North run 10 m, Basin door run 3 m, plus the player-cut Drainage groove. The longest/highest head is now `SPRING_SITE`, giving the watershed's spring node a place.
- Naming does not simulate: no flow is routed along reaches, nothing is carved that the player did not cut, and `channelHeight === heightAt` is asserted at every authored point so the bounded chunk-rebuild guarantees cannot quietly grow. `reachAt(x,z)` gives the route under foot, progress along it and metres above the shallows; routes within 6 m report each other with the measured separation (mutual, and only called a join below 1.5 m, which nothing on this terrain is).
- Player-facing: Current Sense appends the reach name and depth (and whether the cut groove is carrying water), and Places remembered logs stood-on routes as `memory.reaches`, capped at one entry per route, validated on restore, tolerant of older saves with no version bump. One shared `LineSegments` draws the network with vertex colours so walked routes brighten; a geometry per reach was rejected as cost without legibility.
- 76 checks pass (8 new in `tools/reaches.test.mjs`). `browser:world` asserts both sense sentences, that only visited routes are remembered, and the frontier geometry bound, now 24 in the journeys because a chunk geometry can stay registered while its replacement uploads (the old 23 had no room for that overlap once the line mesh existed). Ordinary run: 23 geometries, six textures, 40 calls, 31,236 triangles, 122 line primitives; teardown still zero.
- Screenshot review caught a defect the assertions had missed: with an empty drink log the panel rendered "Drink tracks in 0 place; nearest NaN m undefined." because one value served as both fallback string and found-something sentinel. Fixed, and the exact empty-state string is now asserted in `browser:world`.
- Still open: routes are legible but not walkable-authoritative paths for animals (no pathfinding), no flow travels along named reaches, wildlife art stays primitive, richer Lab play, authored terrain art, screen-reader and real-device validation, hardware frame-rate evidence, asset/legal review and full human QA. Full project NOT complete; waived gates are not evidence of quality.

## Chunk detail budget checkpoint

- `rebuildList` used to give every streamed chunk overlapping `CHANNEL_BOUNDS` 128 segments once a groove existed, i.e. a 32,768-triangle mesh for a 0.44 m cut, on up to nine chunks. It now keeps 128 only on the chunk the body stands on and drops to 64 for the ring around it, still double the ordinary 32 so a neighbour beside you never looks coarser than the rest of the neighbourhood. Contact physics is analytic and unchanged; the standing chunk stays dense, so geometry and contact authority still agree vertex for vertex (asserted by `browser:channel`).
- `npm run perf` gained two forced-stage-4 scenarios (in the groove, and viewed from the next chunk over) measured one run per rule: 55,241 triangles and 83.2/83.3 ms unchanged in the first, 56,445 to 31,869 triangles and 66.6 to 50.0 ms median in the second. The triangle drop is the reproducible result; a one-frame median shift under shared-CPU software rendering is treated as noise, and no hardware or mobile number exists.
- `tools/png-diff.mjs` (new, dependency-free PNG decoder + `tools/png-diff.test.mjs`, 5 checks) answers "is that visible?" against a control pair: 0.0011 mean channel delta for a pose the rule cannot touch versus 0.0005 for the far view and 0.0227 when standing on the chunk border looking down the groove, with at most 0.003% of pixels moved. Cheaper ring LOD is therefore invisible at distance and sub-pixel at the border; recorded rather than hidden.
- 81 checks pass; build, `browser:dist` and all nine browser journeys green. Still open: hardware/mobile FPS, whether 64 segments suffices for a groove that ever spans chunks, authored terrain art, screen-reader and real-device validation, asset/legal review and full human QA. Full project NOT complete; waived gates are not evidence of quality.

## Basin water level checkpoint

- `src/simulation/water-level.js` derives one water height from `Watershed.nodes[wetland].wetness`, anchored so an untouched basin sits exactly on the line it has always used (`WATER_BASE`, verified equal) and bounded to +0.28/-0.05 m. It is derived, not saved: no save version changed, and a restored save reproduces the level from its own graph.
- One authority now: `waterAt(x,z,level)` is what the body swims by, what the herd picks a drinking shore with, what the camera tests for submersion and what the painted shallows are set against, so a shoreline you can see is a shoreline you get wet in. The 1.5 cm paint lift and 5 cm wade offset are named constants with a test that their difference never changes as the level moves.
- The named reaches gained a measured voice: `You are on the North run, a dry channel; 6 m to the shallows, 0.8 m above the water` becomes `water in patches ... 0.6 m above the water` once the basin is fed, and the reach lines colour by measured water rather than by an authored flag. Flow is sampled through the same predicate, so the readout cannot claim water where the body would stay dry.
- `browser:watershed` clears the landslide with real jet pulses and asserts the flooded wording, a shoreline cell count (655 to 707 through `waterAt` in Node) and the restored level. 90 checks pass; all ten journeys, `npm run build` and `browser:dist` green; ordinary run unchanged at 23 geometries / 40 calls / 31,236 triangles, so the pass cost no rendering.
- Found and fixed while building: a `controls`-out-of-scope crash in the render callback that killed the animation loop under adaptive load, a stale-DOM sense read in the journey tool, and a jet fixture pose that slid out of range. See `docs/qa/WATER_LEVEL.md`.
- Still open: no fluid or per-cell water (one scalar from one node; the cut does not widen the painted basin, and `heightAt` not `channelHeight` still decides submergence), no flow travelling along named reaches, Lab/settlement basins keep fixed water tests, wildlife art stays primitive, richer Lab play, hardware/mobile FPS, screen-reader and real-device validation, asset/legal review and full human QA. Full project NOT complete; waived gates are not evidence of quality.

## Deep-time instrument checkpoint

- The Deep Record shaft now measures the player instead of captioning them: `deepTimeLedger()` (pure, `src/simulation/deep-history.js`) turns body depth, seeded strata, `frontier.history`, per-node `erosion`/`sediment`, stage and diversion into one record, and `recordRows()` renders it into a HUD `<dl>` that only exists while `state.place === "record"`. `RECORD_DEPTH = 22` is the single source for the floor mesh, the region's sampled height and the wording on screen.
- The readout cannot invent numbers: a unit test scans every rendered value and requires each numeral to be a ledger leaf, which is how a real defect died (`cutShare.toFixed(1)` on screen while the measurement held `0.32`). The ledger now carries display precision itself, so the cut-share ladder reads exactly 0 / 0.1 / 0.3 / 0.6 / 1.0 % of the 22 m below you for stages 0-4.
- Two clocks stay unconverted on purpose. "Years until the basin fills" was rejected because `erosion` and `sediment` are dimensionless per-tick accumulations with no metres/year scale in the codebase; the limit row says so, and a test fails if any other row mixes years with ticks.
- `browser:world` recomputes the ledger in Node from the page's live state and requires the screen to match row for row (retrying until the paint and the tick line up rather than loosening the comparison), plus asserts the readout stays hidden in the Lab. `tools/deep-time.test.mjs` adds 11 checks: 101/101 pass, all ten journeys, build and `browser:dist` green, ordinary run unchanged at 31,236 triangles and 0/0 geometries/textures at teardown.
- Found and fixed while validating: the HUD's global `dl { display: grid; grid-template-columns: 1fr 1fr }` was laying the shaft log out as a two-column checkerboard (now `display: block`, label above value, 40ch cap, verified by desktop and mobile screenshots); and `browser:watershed`'s restore check compared a pre-click level with a post-reload level across a live tick, failing about half the time (now an exact same-frame derivation check plus a live-follow probe, three runs green).
- Still open: `your cut` reports the depth the channel stage implies rather than a survey of the hole, the strata are authored canon with 20.5 m of banding over a 22 m shaft, no per-reach wear history, no fluid or per-cell water, hardware/mobile FPS, screen-reader and real-device validation, asset/legal review and full human QA. Full project NOT complete; waived gates are not evidence of quality.

## Strata you have read checkpoint

- Standing inside a band of the Deep Record now logs it: `PlaceMemory.strata` holds sorted, bounds-checked indices, `markStrata` is idempotent (hover for a minute, learn once), and `advanceStrataHold` (in `deep-history.js`, beside the ledger it reads) is what earns it — 0.9 s in one band while `|vy| <= 0.6 m/s`, discarding the count on leaving the band and bleeding it while moving fast, measured across six scenarios (hover 0.92 s, shaft floor 0.92 s, tap-hovering 1.57 s, steady descent never, free rise or fall never, bobbing across a boundary never). The instrument answers with `· read` on the band row, a `record read` row (`1 of 8 bands logged`, or `nothing logged · hold still inside a band to read it` before anything is), the caption confirms once for 2.5 s, and the Memory panel says `The record is read in 1 of 8 bands, deepest the 4.`
- `RECORD_DEPTH` and the new `RECORD_BANDS` are the only sources for the shaft's geometry, band count and wording; the panel had to stop reading `record.eras` because the record object is `null` anywhere outside the shaft, which would have thrown on the first panel open after a dive.
- The field is additive at save v6 with no version bump: an old save loads with `[]`, a forged list (`[3, 40]`, `[3, 3]`, `[1.5]`, `"0"`) is rejected, and a full `save → load` round trip keeps `[3, 7]`. `your cut` also stopped implying a hole in the shaft floor and now names the side groove.
- `browser:world` holds the pin, requires the log, requires `strata.length === 1`, requires the learned index to be the band the readout is on, and requires the row-for-row equality with the Node-recomputed measurement to survive the new read state; before the dive it asserts the panel claims nothing. 104 checks pass, all ten journeys, build, `browser:dist` and `npm run perf` green at 31,236 triangles and 66.7/33.4 ms ordinary-run medians, unchanged from the recorded baseline; the hold is three comparisons per frame inside the shaft only.
- Two strict assertions earning their keep: the row-equality check caught this pass's own harness bug (reading `strata` from the wrong level of the probe, which would have compared an unread ledger against a read screen forever), and a fixture that pinned the body without the descend key logged nothing at all — the shaft will not record a band nobody stood in.
- Still open: the first hold rule (an unchanged depth reading) was unreachable in play, because the shaft floats the player at ~6 m/s; the physical rule replaced it and is scenario-tested. No survey of the carved mesh behind `your cut`, no per-reach wear history, readings never gate or reward anything (deliberate: no objective layer), no fluid or per-cell water, hardware/mobile FPS, screen-reader and real-device validation, asset/legal review and full human QA. Full project NOT complete; waived gates are not evidence of quality.

## Wiring is behaviour checkpoint

- A follow-up defect of the strata pass, recorded because it is the interesting kind: the loop in `src/main.js` was still running the first, unreachable hold rule after the patch that was supposed to replace it silently no-op'd on prettier-reflowed anchor text. 105 checks and three browser journeys were green because every one of them pins the body, and a fixture that passes under both rules proves neither.
- `tools/arch-check.mjs` now fails on any named import from a relative module that is never referenced again in its own file — the fingerprint a dead splice leaves. Zero false positives repo-wide, verified to bite by aliasing an import to an unused name. This is a permanent harness rule, not a note to self.
- The shipped rule is `advanceStrataHold(hold, ledger, body.vy, dt)` called from the record branch, with the hold reset whenever `state.place !== "record"` so leaving the shaft cannot bank progress toward a reading nobody made. 105 checks pass with the wiring in place; build, `browser:world`, movement, a11y, dist and perf green at 31,236 ordinary-run triangles.
- `browser:world` no longer pins its way to a reading: it holds the descend key to the floor of the shaft, releases, and requires the deepest band to log itself from input alone (`y: -21.5`, `strata: [7]`, band 8), then requires row-for-row equality with a Node-side recomputation with no fixture in sight. That is the shape of check that would have caught the dead splice, and it is part of the ladder now rather than a note about what is missing.
- Still open: other journeys still lean on teleports and pins, so the "the fixture passes either way" weakness survives elsewhere in the ladder. Everything else from the strata checkpoint stands.

## Test authority checkpoint

- `npm run mutate` (`tools/mutation-check.mjs`, new) inverts or removes one documented contract at a time inside a scratch copy, keeping every file syntactically valid, and requires a **named** unit test to fail. It refuses to run on a red suite and reports a mutation whose anchor no longer matches exactly once, so the list cannot rot into a no-op — the same silent-failure class that let a stale splice ship the wrong hold rule. 14 mutations, 14 caught, 55.5 s for the whole run.
- Mutations are applied to a scratch copy of `src`/`tools` in temp storage; the repository is never written. This replaced an in-place design whose `finally` restore and signal handlers demonstrably failed to run when `SIGINT` landed inside the synchronous suite call, leaving a broken `src/simulation/deep-history.js` in the tree; a stale scratch directory is swept on the next start, so the residual risk is temp-storage litter rather than a corrupted checkout.
- The first run found a gap in the tests, not the game: `WATER_PAINT_LIFT` 1.5 cm → 5 cm changed nothing, because the existing check asserted `WATER_SURFACE_Y - WATER_SHORELINE === WATER_PAINT_LIFT + WATER_SHORE`, an identity true for any pair of constants. `tools/water-level.test.mjs` now pins the values, their order and the fact that the lift is measured from the surface; the mutation is killed. Suite 105 → 106.
- Coverage limits are stated rather than implied: the harness cannot see the DOM, the render loop's wiring in `src/main.js` or GPU cost, so those stay with the journey ladder; and untuned internals (the wetland relaxation constant) are deliberately excluded, because an undocumented number having no test is a fact about the list, not the project.
- Still open: the mutation list grows only when a contract is documented, so it under-covers the newer surfaces (habitat colonisation, settlement response, wildlife gating) that have journeys but few named invariants; other journeys still lean on teleports and pins; no survey of the carved mesh behind `your cut`; hardware/mobile FPS, screen-reader and real-device validation, asset/legal review and full human QA. Full project NOT complete; waived gates are not evidence of quality.

## Colonisation contract checkpoint

- The delayed frontier-to-basin chain (landslide repair → wetland → outlet allocation → Lab water/reeds/insects → sustained eligibility → seeded frog arrival) is now owned by named unit invariants. `tools/colonisation.test.mjs` proves a repaired watershed arrives at frogs, that an unfed basin is off the colonisation clock through two natural causes (a re-blocked landslide, whose bounded window isolates the water rung while the reed-side gates are still lit, and a dead spring), that a lapse in eligibility discards the clock and progress is re-earned through the real clearDebris mechanic, and that arrival is delayed past 110 ticks of eligibility, seed-dependent and deterministic. `tools/wildlife-settlement.test.mjs` gains the caretaker's cistern invariant (reliability tracks a fed cistern up and a starved one down, flipping welcome → check-water) and the response ladder's order (fear, then water, then familiarity). Causes are legal watershed states, not hand-edited scalars: `Watershed.update` recomputes wetness every tick, so a hand-set drought does not survive one step — the first draft of the test got exactly that wrong and was rewritten around causes the simulation itself sustains.
- `npm run mutate` grew 14 → 20 documented-contract mutations: the colonisation gate, the clock lapse, the arrival delay, caretaker reliability pinned to 1, a bowl filled without consuming cistern volume, and drinking from fouled or dried shallows. The reliability mutation **survived the 106-check suite before the new tests existed** — found by an explicit probe that inverted each documented rule and watched for a named failure — and is now killed by name; 20/20 caught in ~93 s.
- `browser:habitat` no longer injects the repair. It clears the landslide with real aimed Space pulses (the same play browser:watershed proves), saves through the Settings control, rewinds the stored clock thirty minutes (the one time fixture, standing in for a wait no test can afford), reloads into the offline tick, and then asserts the rendered consequence on both sides: frontier reeds 3 → 46 of 48 instances, Lab reeds 0 → 40, Lab frogs 0 → 8, basin opacity 0.30 → 0.68, and both sense sentences — "The basin waits for water from the wetland" before, "Fresh water carries reed seeds into the basin" after. Rest edge-latch, twelve Lab/frontier cycles and zero-resource teardown retained. The cycle geometry bound moved 19 → 20 with an added no-growth assertion: the Lab's geometry composition depends on which shared geometries the repair leg uploaded before the first cycle (measured stable across all cycles; teardown still 0/0), so the guard is now "never accumulates" rather than an exact count from one flow. Vantage and door placements remain teleports and the run output says so. Evidence: `docs/qa/habitat-browser.json`, `artifacts/lab-before.png` and `lab-after.png` (opened: an empty bowl with thin water versus reeds, frogs and deeper water).
- `window.__SF.labView()` added so journeys can read what the Lab actually renders; the frontier view remains `habitat`. No simulation, rendering or save-format change: ordinary frontier counts are unchanged (23 geometries / 40 calls in `browser:world`), teardown zero.
- 112 checks pass; all ten journeys, `npm run build` and `browser:dist` green. Still open: teleports and pins remain the fixture class elsewhere in the ladder, no survey of the carved mesh behind `your cut`, hardware/mobile FPS, screen-reader and real-device validation, asset/legal review and full human QA. Full project NOT complete; waived gates are not evidence of quality.
