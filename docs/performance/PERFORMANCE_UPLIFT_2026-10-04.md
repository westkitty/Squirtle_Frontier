# Squirtle Frontier Performance Uplift — 2026-10-04

## Verdict

**PASS.** Ten targeted runtime optimizations produced a material reduction in software-browser frame time and renderer submission cost while preserving gameplay behavior, scene complexity, save semantics, and complete teardown ownership.

This report compares the immediately previous verified runtime (`a9fe6a7dc371fb6026badcaec2fae255f58d4b1e`, run `37171653400`) with the final runtime-equivalent head (`9f62441f0bbf0cf9bc36d591e567b787c3c495e8`, run `37175673624`). Both measurements are Chromium 140 / ANGLE SwiftShader at 960x640. They are useful matched software-renderer evidence, **not representative hardware or mobile FPS**.

## Before / after

| Scenario | Before median | After median | Median delta | Before p95 | After p95 | p95 delta | Draw calls |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| High | 66.7 ms | 50.0 ms | -25.0% | 183.4 ms | 100.0 ms | -45.5% | 41 -> 40 |
| Low | 33.3 ms | 33.3 ms | 0.0% | 83.4 ms | 50.0 ms | -40.0% | 41 -> 40 |
| Channel cut, in groove | 66.7 ms | 50.0 ms | -25.0% | 133.3 ms | 66.8 ms | -49.9% | 42 -> 41 |
| Channel cut, next chunk | 50.0 ms | 33.4 ms | -33.2% | 116.7 ms | 50.1 ms | -57.1% | 29 -> 28 |

Final scene triangle counts are 33,506 normal, 57,535 channel-cut, and 36,935 distant-channel. The uplift was therefore not obtained by removing scene geometry.

The low-quality final sample spent 13.6% of samples over 33.4 ms and 2.7% over 50 ms. High remains expensive under CPU SwiftShader (85.5% over 33.4 ms), so the result is a strong uplift rather than a claim that software rendering now meets a 60 FPS target.

## Ten implemented optimizations

1. **Static collider ground cache.** Fixed obstacles and streamed tree colliders retain their terrain height, eliminating repeated procedural terrain evaluation during body and camera collision.
2. **Reusable collision/environment storage.** Collision result arrays, drink-quality views, movement controls, and water context are updated in place rather than spread/allocated every fixed step.
3. **Static transform freezing.** Static/identity object roots no longer pay automatic Object3D matrix recomputation each frame.
4. **One shoreline draw instead of two.** The lapping pulse moved onto the existing measured shoreline object; visual motion remains, duplicate line submission does not.
5. **Wildlife population reconciliation gating.** Herd membership is reconciled only when population limits change, with reusable actor snapshot and drink-output buffers.
6. **Allocation-free local wildlife searches.** Nearest predator/prey decisions use single-pass searches; separation rejects with squared distance before square root.
7. **Habitat sampling reduction.** Reed positions/heights are precomputed; wildlife terrain is sampled once per actor and shared across all rendered body parts.
8. **Invisible habitat upload suppression.** Distant wetland fauna do not upload instance buffers that cannot be seen.
9. **Effect terrain/path caches.** Rain, mist, fire, dust, and channel foam reuse bounded terrain/path data instead of recomputing expensive procedural samples per particle per frame.
10. **Hot-loop scratch reuse and change-only UI.** Presentation/audio/camera records, canopy/channel-distance lookups, save pose, DOM references, and HUD writes are reused or memoized.

## Stability proof

The final performance harness waits for streaming equilibrium before measuring: exactly nine active chunks and zero queued builds.

Across the 360-frame steady-play window:

- renderer memory: **26 geometries / 6 textures -> 26 / 6**;
- streaming: **9 active / 0 queued -> 9 / 0**, with load/unload counts unchanged;
- Chromium JS heap: **23.1 MB -> 23.1 MB**;
- first 140-frame window: median **33.3 ms**, p95 **50.0 ms**;
- last 140-frame window: median **33.3 ms**, p95 **33.4 ms**.

Teardown then returned renderer memory to **0 geometries / 0 textures**, chunks to **0 active / 0 queued**, and AssetManager to **0 references / 0 cached records**.

## Regression authority

Final verification run `37175673624` passed:

- **245/245** source/architecture/unit tests;
- **69/69** mutation defects killed by named tests;
- production build;
- Core Movement;
- Habitat;
- World / Memory / Deep Record;
- Recovery;
- Channel;
- Wildlife;
- Accessibility;
- Gamepad;
- Multitab;
- Watershed;
- performance, settled stability, and teardown;
- shoreline capture;
- built static production bundle.

Pages build/deployment run `37175673619` also passed.

The new mutation coverage explicitly protects collision-ground caching, wildlife reconciliation gating, reusable presentation records, rain terrain caching, canopy memoization, and distant-habitat upload suppression.

## Measurement repair discovered during the run

The first stability attempt failed for the right reason to investigate, but the runtime was not leaking. The start snapshot was taken immediately after a benchmark teleport while streaming still had replacement chunks queued, so renderer geometry rose from 23 to its settled 26. The harness now waits for nine active chunks and zero queued builds before taking the start snapshot. The repaired full verification run passed.

## Remaining boundary

Representative M1 MacBook, mobile, and real-GPU frame rate remain unmeasured. Do not translate these SwiftShader milliseconds directly into hardware FPS. What is proven is narrower and useful: the same automated renderer workload now has materially lower median/tail frame times, one fewer draw call in each matched scene, flat settled resource ownership, and full behavioral regression coverage.
