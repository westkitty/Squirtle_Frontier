# Uplift salvage and performance gate — 2026-10-04

The uplift at `5fe643590794b48c4dc3a58743e41691653b57ed` was retained selectively.
The matched control was detached revision `2b2dedd2b2187f0735608e1d9e95507257506cf8`,
using Node `v26.9.0`, Chromium 140 / ANGLE SwiftShader, bundled dependencies,
960x640, and the same `BROWSER_BUNDLED=1 npm run perf` procedure.

Three control runs clustered at:

| Scenario | Median | p95 |
| --- | ---: | ---: |
| high | 33.3 ms | 50.0 ms |
| channel, in groove | 33.3 ms | 50.0 ms |
| channel, next chunk | 16.7 ms | 33.4 ms |
| three nearby Squirtles | 16.7 ms | 33.4 ms |

Three final runs clustered at the same buckets. The final runs kept the existing
resource ceilings and ended at 0 geometries, 0 textures, 0 active/queued chunks,
and 0 asset references.

Isolation found the material regression in broad fragment paths rather than draw
submission growth:

- terrain procedural noise, animated ground caustics, and ground shimmer were
  removed; state-texture material differentiation remains;
- the channel fragment `sin/cos/pow` stack was removed; stage color, foam, flow
  motes, and channel geometry remain;
- habitat stone/wood/water/caretaker fragment treatments were removed while
  authored base colors and reed differentiation remain;
- movement scenery trunk/rock/leaf fragment treatments were removed while leaf
  wind vertex motion, authored material colors, and pond vertex ripple remain;
- the full-screen atmosphere returned to the cheap gradient; regional fog,
  rain, underwater, record, and lighting response remain.

The performance gate reads the matched budget in `movement-budget.json`, permits
8.4 ms of tolerance, and requires two confirmation windows. A sustained extra
16.7 ms bucket in median or p95 therefore fails; ordinary one-window timing
noise does not. SwiftShader timing is relative regression evidence only, not
representative Mac/mobile GPU frame-rate evidence.

Regional coordinates now come from `src/simulation/regional-sites.js`. Visual
canyon bias and acoustic gorge ambience both use the canonical `DEBRIS_SITE`
(`x: -6, z: 12`), with focused unit coverage preventing the old coordinate drift.
