# Causal habitat / offline return — 2026-09-30

Approval gates waived by user; no quality acceptance implied.

## Implemented

One-second semantic regional tick, fed by the existing 60 Hz authoritative loop. Clearing the landslide increases wetland water access, then reeds, insects, prey and predators with distinct response times. Outlet allocation informs settlement storage and Lab water renewal. Lab reeds/insects and sustained eligibility precede deterministic seed-dependent frog arrival. Near meshes are capped visual proxies; distant state remains scalar data. This is not complete wildlife AI.

West-bank stone doorway (-11,5) enters a separately rendered basin using R or a touch button. Body/camera use Lab-local ground/water samples. Frontier chunks unload on entry; no dual fully rendered scenes. Lab resources dispose on exit, with the same cached Squirtle retained.

Version 3 saves include location, semantic graph/ecology and wall time. v1/v2 migrate with no retroactive offline grant. Catch-up uses at most 21,600 one-second steps; no camera/body/actor replay. Future timestamps remain intact through clock rollback. A valid backup can load read-only while preserving a malformed primary. A stale loaded generation cannot ordinarily overwrite a newer stored generation. This check is not an atomic cross-tab lock; simultaneous writes remain a limitation. Browser localStorage remains the storage medium; export/import recovery UI is not yet built.

## Executed

- 34 source/behavior tests: propagation, delayed colonization, online/offline equivalence, cap, rollback, same-time repeated reload, backup preservation, stale saves, old migrations, Lab floor/physics and suspend/resume streaming and shared Lab wall/furniture collision proxies.
- `npm run build`: pass, existing large-bundle warning.
- Movement browser: physical locomotion journey, save/reload, 12 chunk returns, 30 asset cycles, touch cancellation/layout.
- Watershed browser: Sense + active keyboard Jet + repaired graph reload; explicit setup teleport.
- Habitat browser: keyboard door entry, explicit repaired-save and 30-minute wall-clock fixture, reload with colonization, twelve Lab/frontier cycles, zero chunks/geometries/textures/refs on full shutdown. See `habitat-browser.json`.
- Ordinary frontier performance rerun: `phase1-measured.json`; software median 116.7 ms high / 66.7 ms low, p95 316.7 / 150.1. Timing still misses targets; no hardware conclusion.
- Opened `artifacts/lab-before.png`, `lab-after.png`, `phase1-bank.png`. Visible before/after reeds and frog proxies; crude basin/buildings/animal geometry, not final art. Artifacts are intentionally gitignored.

## Repairs and limitations

Initial online/offline test exposed sub-picosecond accumulator residue; snapping the one-second remainder below 1e-9 to zero removed drift and the test passes. Source data validation remains atomic before live state assignment. Clock rollback regression added. Page hide avoids replacing a hidden-tab timestamp without simulating the interval.

No real-time 30-minute wait claimed. No human movement/audio/touch pass, complete ecology AI, seamless micro-route, final settlement or Lab interaction, hardware FPS pass, or full game completion claimed.
