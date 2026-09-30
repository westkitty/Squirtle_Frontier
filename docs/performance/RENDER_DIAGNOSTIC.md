# Phase 1 bounded repair / 2026-09-30

Historical controlled experiment at cf91e53: `render-diagnostic.json`. Reproduce with a running dev server and `BROWSER_BUNDLED=1 node tools/render-diagnostic.mjs`; output goes to ignored artifacts. Diagnostic interception changes antialiasing per fresh context and forces gl.finish; this is NOT production code or a hardware benchmark. Two repeats, 960x640, discard first ten samples.

Clear-only wall median ~16.7 ms; scene with MSAA ~169–175 ms; no MSAA ~111 ms; half linear resolution ~58 ms. JS submission and finish medians below 1 ms. This supports a software rendering/presentation bottleneck, not a simulation rewrite; asynchronous browser scheduling means gl.finish timings alone do not isolate raster time.

Repair disables MSAA and caps high/medium/low at 2,073,600 / 921,600 / 230,400 pixels and ratios 1.5 / 1 / .75. CSS layout and simulation are unchanged. No automatic device-quality inference. Low is visibly softer; final hardware-driven defaults remain unaccepted.

Post-repair ordinary app sample (`phase1-measured.json`): high median 133.3 ms / p95 233.4; low median 66.7 ms / p95 100. Same 26 draw calls, 31,026 triangles, 15 geometries and six textures. Full teardown zeroes geometry, textures, chunks, references and cache. High did not materially improve over the earlier ordinary sample; do not equate controlled diagnostic improvements with a demonstrated across-the-board gameplay gain. Software FPS gate STILL FAILS. Hardware/mobile timing unavailable.
