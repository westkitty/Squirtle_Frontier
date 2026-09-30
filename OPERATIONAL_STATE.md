# OPERATIONAL_STATE

project_id: squirtle-frontier
project_name: Squirtle Frontier
revision: 4
status: Phase 0 software-browser baseline passed / Phase 1 starting

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

- Destination identity: `westkitty/Squirtle_Frontier`, branch `arena/01a0f3be-squirtle-frontier`; initial HEAD `1203240775c3b91ecca64647fe96f257a84b156a`.
- Read-only reference snapshots: Living Frontier `bdea0434d99b1d0d902fd00826b17a7126731471`; Squirtle Lab `a8face4e8969254940cc5ff5c120e3decf555a57`. Neither source repository modified.
- Build guide and master prompt already exist; stale pending items removed.
- Original Squirtle ZIP preserved and hash verified. OpenCollada structural inspection: 26 joints, two materials, zero animation elements; not a rendered asset acceptance.
- `npm run check`: source syntax/authority checks and seven tests pass, including 100 CPU-side chunk crossings and teardown, deterministic RNG/terrain, fixed-step bounds, semantic save roundtrip and storage failure handling.
- `npm run build` passes, with a recorded >500 kB bundle warning.
- `npm audit` reports zero known vulnerabilities following non-force dependency repair.
- Vite starts on `0.0.0.0:5173`; HTTP HTML/manifest requests and an Arena-style Host header succeed. Browser rendering remains unverified.

## Implemented but unverified

- Renderer/inspection camera, semantic HUD, keyboard input, separate settings, terrain streaming adapter and complete baseline teardown.
- Self-hosted asset-manager infrastructure with empty runtime manifest; no imported model instances yet.
- Hardware performance and imported-model lifecycle remain unverified.

## Historical blocker (resolved)

- Chromium installation failed with CDN TLS ECONNRESET. One bounded curl fallback also failed with SSL_ERROR_SYSCALL. Browser test fails at launch because executable is absent.
- Browser capability restored using npm-distributed Chromium and bundled libraries. `BROWSER_BUNDLED=1 npm run browser` passes 24 crossings/four matched return checkpoints, with stable renderer counts and zero page/console errors. Rendered screenshot inspected. Measurements in `docs/performance/phase0-measured.json`; software renderer only.
- Phase 0 software-browser foundation gate passed. Phase 1 may begin. Phase 2 remains blocked on movement gate.

## Scope limits and pending

- Current rendered scaffold is an inspection rig, not a trainer or Squirtle controller.
- Full save recovery, offline simulation, PlayableCreature, GLB conversion, movement, touch controls, watershed, ecology, settlement, Lab and Deep Record remain pending.
- Asset licensing/redistribution clearance is not implied by the supplied fan-source archive.
- Continue Phase 1: convert and validate asset, add PlayableCreature seam, locomotion and touch/camera; do not bypass human movement acceptance.
- Human ten-minute movement enjoyment and real-device mobile validation remain external evidence requirements for later gates.
- Detailed evidence: `docs/architecture/BASELINE.md`, `docs/assets/SQUIRTLE_INTAKE.md`, `docs/performance/BASELINE.md`.
