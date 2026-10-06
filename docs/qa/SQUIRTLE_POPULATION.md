# Squirtle population integration — validation contract

This change makes non-player Squirtles a bounded ecological population rather than quest NPCs.

## Architectural contract

- Distant Squirtles are aggregate `SquirtleEcology` data.
- At most three nearby Squirtles are live local actors.
- Only meaningful individuals enter bounded `PlaceMemory` persistence.
- NPC Squirtles never use the player controller.
- Saltwater and Deepwater ecotypes are implemented but habitat-ineligible in Stillwater.
- Shucker pressure is rare, separate from ordinary humans, and never removes player control.
- Shucker evidence exists only when real Shucker pressure is active; nearby Squirtles react through ordinary hide/flee behavior. The retired Sense telemetry is no longer part of the proof.
- NPC visuals reuse `playable.squirtle` through `AssetManager`; each visible clone owns its material clones and releases its asset reference.

## Required proof before closure

Run `npm run check`, the focused Squirtle ecology tests, `npm run mutate`, `npm run build`, `npm run assets`, all affected browser journeys, the Squirtle social browser journey, `BROWSER_BUNDLED=1 npm run perf`, and teardown/resource proof.

Do not claim representative hardware/mobile FPS from the bundled software renderer. Do not mark this integration verified in `OPERATIONAL_STATE.md` until those checks pass on the actual repository state.
