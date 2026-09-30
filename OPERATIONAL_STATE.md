# OPERATIONAL_STATE

project_id: squirtle-frontier
project_name: Squirtle Frontier
revision: 11
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
- Authored spring/landslide/wetland/outlet graph plus optional spring-to-outlet diversion. Nearby aimed Jet initiates the side groove, whose short local path descends sampled terrain. Diversion improves blocked-outlet supply but takes water from wetland after full repair. This is not a full generated watershed network or staged collision terrain.
- Deterministic weather drives source supply, bounded 4x4 fire spread/fuel/ash/wetness and ash runoff. Jet suppresses nearby fire. Rain/fire/channel presentation uses two extra shared geometries and fixed instance limits. No global fluid or continuous erosion.
- Player-only surveyed cells/landmarks, bounded 90-sample regional history, and one Lab frog identity/familiarity/fear persist. Offline time does not discover map cells or create encounters. Visitor mesh reacts simply to familiarity/fear; full AI and named settlement behavior remain pending.
- Deep Record reached from the submerged Lab centre (R), then Q/E to descend/ascend through eight seeded aggregate historical strata; exit near surface. Lab/Record/frontier are mutually rendered, exterior chunks unload, shared Squirtle stays cached. Record reload resumes at surface; full body-pose persistence remains pending.
- Version 4 save migrates versions 1–3; includes graph, regional fields, memory, location and wall clock. Six-hour offline cap, rollback handling, ordinary stale-tab conflict detection. Settings provide stored-save export, validated confirmed import and explicit backup recovery; replacements preserve prior bytes in one quarantine slot. Atomic multi-tab transactions remain pending.
- 43 automated source/behavior tests pass. Production build passes with large bundle warning (~627 kB). Movement, repair, habitat, new world and recovery browser journeys executed. World journey: keyboard bypass, fire suppression, map, dive/ascent, 12 Record/Lab cycles and zero-resource teardown. Setup teleports/seeded conditions are explicit test fixtures, not claims of entirely walked playthroughs.
- Frontier geometry bound <=23; ordinary run 22 geometries / six textures / 35 calls. Software median ~133 ms high / ~83 ms low, p95 ~317 / ~167 ms at 960x640: FPS target NOT met here; hardware/mobile performance unknown.
- Opened Deep Record, fire, map, marked-visitor and touch-settings screenshots. Found and repaired mobile nav/title overlap. Caption/controls visible, world remains crude geometry; marked visitor was partly occluded by avatar in captured pose, not a complete visual acceptance.
- Keyboard-focus regression exposed by Memory panel repaired: canvas is focusable and receives focus on pointer interaction. Escape dismisses panels, opening one closes others, repeated keydown does not retrigger rest, touch clear releases captures/resets stick.
- User waived approval gates; human enjoyment, audio, real touch usability and device performance remain unverified, NOT passed. No public deployment claimed.

## Remaining scope / completion truth

Full project NOT finished. Major remaining work: world-scale terrain-derived watershed/alternate route topology, staged terrain/collision changes, traversable micro-route network, production wildlife/settlement behavior, richer Lab play, polished/accessible presentation and controls, robust concurrent storage, measured hardware FPS, asset/legal review for distribution, and full end-to-end causal/human QA. Current systems are bounded foundations, not sufficient evidence to claim excellent movement or final production completion.

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
