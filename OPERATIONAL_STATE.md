# OPERATIONAL_STATE

project_id: squirtle-frontier
project_name: Squirtle Frontier
revision: 6
status: Phase 1 playable movement slice / technical checks pass / human-quality gate open

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

## Current verified state

- Destination: `westkitty/Squirtle_Frontier`, branch `arena/01a0f3be-squirtle-frontier`; initial HEAD `1203240775c3b91ecca64647fe96f257a84b156a`.
- Read-only sources: Living Frontier `bdea0434d99b1d0d902fd00826b17a7126731471`; Squirtle Lab `a8face4e8969254940cc5ff5c120e3decf555a57`. Neither edited or pushed.
- Phase 0 baseline committed/pushed as `8a565ec`. Browser capability restored via npm-bundled Chromium; historical TLS/apt failures retained in baseline evidence.
- Original Squirtle archive preserved/hash-verified. Runtime GLB: 981,708 bytes, 26-joint rig, correct 0.55 m bounds, two mapped materials; zero validator errors and one documented skinned-parent warning. No source clips invented.
- Direct control through independent body-state logic and PlayableCreature presentation boundary: walk/run, swim/dive/ascent, shell-slide and Water Jet. Creature-scale camera, settings, procedural audio and bounded VFX implemented.
- `npm run check`: all source checks and 20 tests pass (100 CPU chunk crossings, movement transitions/collision, 6000 state steps, tree proxies, save skeleton).
- `npm run build` passes, retaining recorded large-bundle warning; dependency audit zero known vulnerabilities.
- Actual browser journey passes physical land-to-water traversal, dive/boost/ascent/surface launch, camera drag, settings and position save/reload; zero captured page/console errors.
- 12 rendered chunk-return cycles bounded at <=16 geometries / six textures; 30 extra rendered Squirtle instances release to one cached model/reference without mutable material leakage.
- Awaited full shutdown reaches zero chunks, geometries, textures, cache entries and references.
- Touch CDP stick movement/cancellation and portrait/landscape layout checks pass in desktop emulation. Actual mobile performance and human usability are NOT verified.
- Rendered front/back asset, bank, shell, swim, underwater, touch portrait and landscape screenshots opened and inspected. Not final visual/animation acceptance.

## Implemented but unverified / mandatory gate open

- Human ten-minute no-objective movement enjoyment: no evidence. Phase 1 MUST NOT be called passed.
- Procedural animation polish, body-specific tactile movement quality, human camera/touch usability and heard audio quality remain unverified.
- Hardware GPU/mobile performance unavailable. Software-renderer sample at 960x640: median ~133 ms high / ~67 ms low, p95 ~233 / ~100 ms. This fails the desktop FPS target in the measured environment; no hardware acceptance can be inferred.
- True creature-scale terrain LOD, remapping and broader accessibility coverage remain pending.

## Current scope / blocked progression

- Phase 2 NOT started. The pond is an authored locomotion test volume, not a watershed. No fake hydrology, offline chain, ecology, settlement, Lab or Deep Record has been substituted for simulation.
- Save remains an explicit position/time skeleton; reload resets transient movement at terrain contact. Full semantic persistence/recovery/offline work remains pending.
- Latest coherent work is the Phase 1 technical movement slice, not a complete game/prototype.
- Next required external evidence: a human ten-minute movement playtest and representative desktop GPU/mobile timing. Fix concrete feel/performance failures before expanding systems.
- Evidence: `docs/qa/PHASE1.md`, `docs/qa/phase1-browser.json`, `docs/performance/phase1-measured.json`, `docs/assets/SQUIRTLE_INTAKE.md`.
- Do not claim deployment: only local/preview development routes have been opened.

## Phase 1 bounded repair checkpoint

- Downhill grounded contact and slide entry now prevent repeated landing/tap impulses; cliff and intentional launch regression tests pass.
- Camera constrains the final smoothed boom against terrain and inflated finite-height obstacle cylinders; orbit/recovery tests at 30/60/120 Hz pass. Both look axes respect sensitivity.
- MSAA disabled; explicit render-pixel budgets added. See `docs/performance/RENDER_DIAGNOSTIC.md`; software performance still fails the target. No further speculative optimization pass or Phase 2 expansion authorized by this evidence.
- Re-ran 20 tests, production build (bundle warning persists), physical browser journey, 12 chunk returns, 30 asset cycles, touch cancellation and full teardown. Bank, portrait touch and underwater screenshots opened after repair: character and controls readable; low detail visibly softer. No human feel/audio acceptance inferred.
- External blocker unchanged: ten-minute objective-free human playtest, heard audio and real touch usability, representative hardware GPU/mobile timing. Phase 1 gate remains open; project is NOT finished.
