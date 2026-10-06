# Legacy named-reach evidence and retained background route data

The watershed has always been a graph of nodes (spring → landslide → wetland →
outlet), but the physical world only had one named water feature: the drainage
groove the player can cut. Everything else was "walk downhill and hope". This pass
gives the inflows places, and names them, without touching the simulation.

## What was added

`src/simulation/reaches.js` traces each authored source across the **same**
`heightAt` the body walks on: sixteen candidate directions per step, descent
leading and a weak pull toward the basin metric that the movement region already
uses for open water, stopping at the first submerged point. Anything that loops or
stalls is dropped rather than promised to the player, so every authored route
actually ends in water.

Result on the current terrain: Spring gully 27 m, South draw 25 m, Long spur 15 m,
North run 10 m, Basin door run 3 m, plus the player-cut Drainage groove. The
highest, longest route is the headwater the watershed calls the spring, so
`SPRING_SITE` now exists as a place rather than only as a node id.

`reachAt(x, z)` reports which route you are standing on, how far along it you are,
and how many metres above the shallows that is. Routes closer than 6 m report each
other with the measured separation (`Long spur` runs 3.8 m from `Spring gully`);
below 1.5 m would be called a join, and nothing on this terrain qualifies, so the
network says "beside" rather than inventing a confluence.

## What the player gets

> **Phase 2 authority note — 2026-10-06:** Current Sense, named-reach diagnosis, the player-facing reach line mesh and Memory-panel waterway telemetry have been removed. The measurements below are retained only as historical evidence for the superseded runtime. Route geometry/memory may remain internal data; ordinary play must not depend on them.


- Holding Current Sense anywhere on a route appends "You are on the Spring gully;
  27 m above the shallows." On the cut groove it also states whether it is actually
  carrying water, which is the honest reading of a channel the player carved.
- Places remembered logs which reaches were stood on, in the same observation
  channel as survey cells and drink tracks, and the panel reads "Water followed:
  Spring gully (27 m) · Drainage groove (3 m). 2 of 6 reaches."
- One shared `LineSegments` draws the whole network, vertex-coloured: walked routes
  brighten, the dry groove lights up when the cut starts carrying water. A geometry
  per reach would have cost more than the legibility bought.

## Invariants proved by tests

`tools/reaches.test.mjs` (7 checks) pins the parts that could otherwise rot quietly:
every authored route descends into water within a bounded length; tracing is pure,
so the network cannot drift between loads; naming a route must not change the
ground under it, asserted as `channelHeight === heightAt` at every authored point
and a `CHANNEL_BOUNDS` box still small enough for the bounded chunk rebuilds the
streaming tests rely on; `reachAt` reports real progress and returns nothing past
its radius or on unrelated ground; near-route claims are mutual and measured; the
memory field caps at one entry per route, rejects unknown ids and duplicates,
restores empty for saves written before it existed, and round-trips through a
version 6 save. No save version bump: the field is nested inside memory and its
decoder accepts absence.

## Executed evidence

- 76 checks pass. `browser:world` now stands at the spring head and on the groove,
  asserts both sense sentences, that only the two routes actually visited are
  remembered, and that the whole network fits in the frontier geometry bound.
  Evidence: `docs/qa/world-browser.json` (`senseAtSpring`, `senseAtGroove`,
  `waterNote`, `reachGeometry`).
- Ordinary frontier run with the network visible: 23 geometries, six textures,
  40 draw calls, 31,236 triangles and 122 line primitives. The hard bound in the
  journeys is 24, because a chunk geometry can stay registered while its
  replacement is uploaded; the earlier bound of 23 had no room for that overlap
  once the line mesh existed. Teardown still reaches zero geometries and textures.
- Screenshot `artifacts/world-memory.png` shows the ribbon on the ground and the
  new panel line. Reviewing it caught a real defect the assertions had missed: with
  an empty drink log the panel rendered "Drink tracks in 0 place; nearest NaN m
  undefined." because the fallback string was also used as the "found something"
  sentinel. The panel now reads "No drink tracks yet. Animals drink where the
  shallows run clean." and `browser:world` asserts that exact empty-state string so
  it cannot regress.

## Deliberately not done

Reaches are not simulated: no flow travels along them, the wetland's water still
comes from the watershed node maths, and nothing is carved that the player has not
cut. The route network is a _legible reading_ of the terrain plus the one channel
the player can change, not a hydrology model, and it is not a pathfinding graph for
animals — the herd still drinks where the world reports water.
