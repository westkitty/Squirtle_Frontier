# Phase 0 architecture record

Inspected 2026-09-30. This records implemented ownership and source correspondence, not a replacement implementation plan.

## Source identity

- Destination start: `westkitty/Squirtle_Frontier`, `1203240775c3b91ecca64647fe96f257a84b156a`.
- Working branch: `arena/01a0f3be-squirtle-frontier`.
- Living Frontier reference snapshot: `bdea0434d99b1d0d902fd00826b17a7126731471`.
- Squirtle Lab reference snapshot: `a8face4e8969254940cc5ff5c120e3decf555a57`.
- References were fetched with read-only GitHub API calls into separate workspace snapshots. Neither source repository was edited or pushed.

## Ownership map

| Area | Living Frontier foundation | Destination status |
|---|---|---|
| Render/update | `main.js`, `loop.js`, one renderer animation loop | Minimal boot, single loop, bounded fixed-step update; no humanoid controller copied |
| Generation | `rng.js`, `worldgen.js` seeded heightfield | Copied without functional changes; source sites remain inert generation data, not rendered settlements |
| Terrain | `terrain.js` keyed ChunkManager, budgeted rebuild queue, per-chunk geometry disposal | Source terrain retained; `Streaming` owns radius-one region, counters, teardown |
| Canonical state | `worldstate.js` owns all persistent semantics | Reduced owner with seed, time, inspection position, ground plane; ecology not activated |
| Actors | `entities.js` nearby actors from regional populations | Not ported; distant existence must remain aggregate data |
| Interaction | `interaction.js` authoritative action dispatch | Not ported; no trainer, combat, quest UI, or imported-node gameplay authority |
| Assets | `assets/asset-manager.js`, animation-runtime, actor-visual | Manager adapted to package-local Three loaders and self-hosted public manifest; empty runtime manifest |
| Persistence | `persistence.js`, `save-recovery.js`, world-recovery | New deliberately limited versioned semantic skeleton; reports failure, retains corrupt source on load; not section recovery/offline implementation |
| Preferences | `settings.js` separate from world | Copied with destination storage namespace |
| UI/input | `player.js` Input, DOM UI, map-ui, styles | Small semantic inspection shell and abortable normalized keyboard input; no claim of touch locomotion |
| Weather/fire/ecology | `worldstate.js` weather, region aggregates, fuel/fire grids | Reference authority retained in design; not copied into active simulation |
| Settlements/factions | worldstate + streaming structure hashes | Not active; future presentation must reconstruct from canonical state |
| Cartography | `cartography.js`, `map-ui.js` surveyed ground | Not ported |
| History | `history.js`, `deeprecord.js` aggregate record | Not ported |
| Audio | `audio.js` coherent procedural graph | Not ported |
| QA | `tools/arch-check.mjs`, perf-probe, asset lifecycle tools | Destination-specific syntax, authority, deterministic generation, persistence, 100-crossing lifecycle tests; browser probe prepared but blocked |

The copied `terrain.js` still contains unused source water presentation helpers. They are not invoked and are not semantic hydrology. No watershed has been implemented. No global fluid or erosion simulation exists.

`src/main.js` exposes `window.__SF` diagnostics for the inspection rig. This is not the PlayableCreature seam and not an avatar. Phase 1 must create the semantic adapter before attaching Squirtle; source mesh names must remain inside presentation code.

## Lifecycle boundaries

- Streaming owns chunk geometry, shared terrain material and ground texture; explicit teardown disposes all three.
- Main owns renderer, scene, input subscriptions and loop. Input uses AbortController; hot teardown and page exit stop scheduling.
- AssetManager owns cached GLTF resources. No runtime asset is registered or acquired yet; model-instance material and skeleton lifecycle remain unverified.
- Performance and screenshots are not inferred from Node scene-object tests.

## Source provenance / rights

Code adapted from the user's designated Living Frontier repository under the authorization for this destination. No independent source-code license grant is asserted here. No Living Frontier external creature/human/structure assets were copied. Three.js is installed from npm with its package license.

Squirtle Lab is a seeded reconstruction contract, not an implemented Lab engine. Its room count and trainer-style handling are not imported. Applicable constraints include creature-first framing, one-heavy-environment lifetime, persistent cached character, instance-owned animated materials, camera accessibility and evidence-based animation mapping.
