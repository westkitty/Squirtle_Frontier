# The basin has a water level

## What changed and why

The movement region's water used to be an authored test volume: one ellipse, one fixed
shoreline at `WORLD.water - 0.05`, painted by a disc that sat 1.5 cm above that surface.
The watershed graph decided how wet the reed shallows were and what colour the water was,
but nothing it decided moved the edge of the lake. So `Watershed.nodes[wetland].wetness`
now sets one height, and everything that touches water touches that number:

- `src/simulation/water-level.js` (new) — `waterLevelFor(wetness)` plus the shoreline,
  painted-surface and reach-fraction helpers. Constants are named and the anchor is
  measured: `WETLAND_PRISTINE = 0.05` is what the wetland converges to at the authored
  0.95 blockage, so an untouched save sits on `WATER_BASE` **exactly** (a `toFixed(6)`
  quantisation, not a rounding of behaviour).
- `src/worldstate.js` — `get waterLevel()`. Derived, never stored.
- `src/player/movement-region.js` — `waterAt(x, z, level = WATER_BASE)`. One predicate,
  now level-aware, defaulting to the old line so no caller is forced to change.
- `src/main.js` — the live region, the camera's submersion test and the painted shallows
  all pass `state.waterLevel`; the sense line and the Memory panel read the measurement.
- `src/player/watershed-presentation.js` — the reach lines take their hue from whether
  water is actually in them; being walked still brightens a line, so the map has one
  signal per channel instead of two competing ones.
- `tools/watershed-browser.mjs` — the journey clears the landslide with real jet pulses
  and asserts the flooded wording, the shoreline count and the restored level.

## Why derived rather than saved

Storing a level would have meant another number that can disagree with the graph. Because
it is `f(wetland wetness)`, a restored save gets the level its own graph implies
(`watershed-browser.json`: `waterLevel.after === levelAfterReload`, `0.182405`), offline
catch-up cannot drift it, and no save version bump was needed.

## Invariants pinned by `tools/water-level.test.mjs` (9 checks)

- Zero drift: an undisturbed basin sits exactly on `WATER_BASE`, and `waterAt` called
  without a level is identical to `waterAt` called with it, at sampled shoreline points.
- Monotone and bounded: the level only rises with supply, never above `+0.28 m`, never
  below `-0.05 m`; a missing or NaN wetness is read as an empty wetland, i.e. the floor.
- The save carries no level key.
- Rim width is constant: `WATER_SURFACE_Y - WATER_SHORELINE` is always
  `WATER_PAINT_LIFT + WATER_SHORE`, so raising the water never makes the damp band under
  your feet wider or narrower.
- `waterAt(...).level` stays the _surface_ the body floats on, not the shoreline.
- Reach flow is sampled through that same predicate, at route points excluding the ends,
  and measuring never mutates the network.
- A pool at the mouth is not a run: the fraction excludes the mouth, and
  `REACH_FLOW_FRACTION` is a strict interior threshold.
- Measured response: `spring-gully` reports no water at any supply the wetland reaches
  without a flood, `drainage-groove` doubles its wet fraction when the basin is fed and
  halves it again as the side route drains.

## Executed evidence (2026-10-01)

`npm run check` 90/90 (9 new). Build clean. All ten browser journeys green, including
`browser:watershed` (rewritten), `browser:world` (new sense/panel assertions),
`browser:channel` (the standing-chunk/contact authority still agrees) and `browser:dist`.

From `docs/qa/watershed-browser.json`, with the landslide cleared by jet pulses:

| measured                                         | before                                                      | after                                                          |
| ------------------------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------- |
| `state.waterLevel`                               | -0.029                                                      | 0.182                                                          |
| sense on the north run                           | `a dry channel; 6 m to the shallows, 0.8 m above the water` | `water in patches; 6 m to the shallows, 0.6 m above the water` |
| shoreline cells (1 m grid, Node, real predicate) | 655                                                         | 707                                                            |

`shorelineCells` is computed in the tool through `waterAt`, not estimated, so the number
is the same function the body and the herd consult.

Performance is structurally unchanged — `docs/performance/phase1-measured.json` after this
pass: 23 geometries, six textures, 40 calls, 31,236 triangles, 122 line primitives,
66.7 ms median (high) / 33.3 ms (low) on ANGLE SwiftShader at 960x640. No mesh was added
for the level; one existing disc moves. Still no hardware or mobile measurement.

Whether the change is _seen_ was checked the other way round from the LOD pass: two
screenshots of the same pose, pristine against flooded, differ on `tools/png-diff.mjs` by
mean channel delta 1.49 with 4.4% of pixels moved. For comparison, the deliberate
triangle saving in the chunk-detail-budget pass measured 0.0005 and 0.001%. One change is
invisible and free, the other is visible and this pass's whole point.

## Defects found while building this

- **A scope crash, mine and same-session:** the first cut of the "don't overwrite the
  sense line with the render-scale notice" guard read `controls` inside the render
  callback, where only the step callback has it. Under load the adaptive notice fired,
  threw, and killed the animation loop: the body froze mid-frame and the journey's
  assertions reported nonsense positions. Fixed by latching `senseHeld` in the step
  callback. The journey's `deepEqual(errors, [])` gate was also moved to the end, so it
  now covers every step added by this pass instead of stopping in the middle; the crash
  was invisible to the earlier gate.
- **A stale DOM read is not an assertion.** The sense helper polled `#status` for
  `You are on the` and passed on the previous F press's text, which is why it reported the
  Drainage groove while the body stood on the north run. `sense()` now blanks the element
  before pressing the key. The game is right to keep the last message visible; the tool
  was wrong to read it as fresh.
- **A pose that cannot hold.** Placing the body on dry slope beside the debris to spray it
  let gravity slide it out of the jet's 2.8 m range between pulses, so the loop looked
  stuck at `blockage 0.87`. The fixture pose is now the one the journey already used —
  floating beside the debris — with the aim and range checks unchanged. Jet activation,
  aim and range are still exercised through the input path, but the browser script
  repositions the body between pulses. This proves the repair mechanic under controlled
  setup; it does **not** prove that a human can approach and hold that position through
  ordinary locomotion.
- **A pre-existing offset worth naming:** the painted shallows sit 1.5 cm above the surface
  and the wade line 5 cm below it, so a narrow band of ground looks wet and walks dry.
  This pass kept both numbers deliberately — moving them would have moved where the body
  starts swimming — and made them single-sourced constants (`WATER_PAINT_LIFT`,
  `WATER_SHORE`) with a test that the _difference_ never changes with the level.

## Deliberately not done

- No fluid, no per-cell water, no volume. One scalar from one node; a lake that must not
  flood a whole chunk still cannot, and `WATER_RISE`/`WATER_FULL_RISE` bound it.
- The cut groove is not carved _into_ the water predicate: `waterAt` still samples
  `heightAt`, not `channelHeight`, so digging lowers the floor you stand on without
  widening the painted basin. The reach readout therefore only claims water where you
  would also get wet, which is the whole reason it is allowed to speak.
- Reach flow is a measurement, not a simulation: no water travels along a route, supplies
  are not redistributed by it, and `basin-door` reading 25% wet at every level is the
  terrain, not a flow model.
- The wildlife, settlement and Lab basins still use their own fixed water tests; only the
  frontier basin has a level.
- The shoreline is asserted as a cell count on a 1 m grid in a tool, not as a rendered
  pixel area, and the visual claim rests on one 900x560 screenshot pair.
