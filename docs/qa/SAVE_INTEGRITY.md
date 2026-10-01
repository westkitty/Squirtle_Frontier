# Save Integrity And Pose Resume (Version 6)

The save is the only bridge between sessions, and two tabs can open it at once. Both problems now have unit coverage and real-browser evidence.

## What a save records

Version 6 keeps the legacy `player` x/z used for arrival and place transitions and adds `pose`: `{x, y, z, yaw, place}`, written from the live body every frame. A pose must be finite, within |1000| on the plane, with `y` in [-24, 60] and a finite `yaw`; anything else fails the entire decode, so the previous live state stays byte-for-byte identical instead of half-applying. Versions 1 to 5 decode with `pose: null` and keep the older ground-on-arrival placement. `tools/save-integrity.test.mjs` covers round trip, rejection and v5 migration; the invalid-pose case asserts `load()` reports failure and the snapshot is unchanged.

## Resuming from a pose

`resumeFromSave()` in `src/main.js` applies the pose only when it belongs to the place being entered, then runs 24 real physics steps with no input so grounded/swim/slide state and vertical velocity are re-derived from terrain and water; a stored mode flag is never trusted. Measured in `docs/qa/multitab-browser.json`: a body saved mid-dive at `y -0.813` reloads into the Lab at `y -0.42`, mode `swim`, 0 m from the basin axis, then rises as buoyancy reasserts. That upward drift is physics, not a save fault: the save restores position, not a held input state.

## Concurrent tabs

`commitSave`, `commitLoad` and `adoptStored` run their read-modify-write core inside `navigator.locks` in exclusive mode when the browser offers it, with a re-entrancy guard, and fall back to a direct call in Node and older browsers. A tab whose write no longer matches what is stored is refused instead of clobbering the newer generation, and is not marked permanently blocked: the status text names the conflict ("Save changed in another tab; reload before saving.") and the Settings panel offers **Adopt the newer stored world**.

Adoption is read-only by construction (`load` with `offline: false`), because a visible tab has already been simulating and must not be handed retroactive catch-up or a rewrite of the winner's bytes.

`tools/save-integrity.test.mjs` forces a yielding window inside the critical section, so an interleaved read-modify-write would be observable, and checks that adoption leaves the stored string identical and is idempotent.

Two real tabs in one browser context (`browser:multitab`, same origin so `localStorage` is shared): the walking tab saved at elapsed 7.17s with pose x -10, z 15.7634; the second tab's save was refused with that message and storage still held the driver's `player.x` -10; after adoption the follower reported "Adopted the newer stored world (7s of growth)." and its body sat at x -10, y 0.8673 — the adopted pose, not its own older position.

## Recovery and import are pose-aware

`browser:recovery` now proves an imported generation resumes from its pose: `player.x` -9, pose x -9, body x -9 with `pageerror` count 0. Export, malformed-import rejection, quarantine of the previous bytes and explicit backup restoration are unchanged.

## Deliberately not done

No cross-device or profile sync, no merge of divergent worlds (adoption is the last-write-wins _read_, never a blend), and no lock-based multiplayer. Two different browsers or machines still own two separate worlds.
