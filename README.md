# Squirtle Frontier

A systemic browser game in development where **you directly control Squirtle, not a trainer**.

## Current slice

**Phase 1 movement study: Stillwater Reach.** Walk/run, swim/dive, shell-slide and Water Jet around a small streamed proving ground. There are no objectives yet. The training pond is not the future semantic watershed.

Technical movement, browser, asset and lifecycle checks pass. **The Phase 1 quality gate remains open**: ten-minute human enjoyment, actual hardware performance, touch usability and audio review are not verified. The user has waived approval gates for continued implementation. Phase 2 semantic hydrology is in progress; its graph is saved and simulated but not yet connected to visible water or physical repair.

## Run

```sh
npm ci
npm start
```

Vite binds to `0.0.0.0:5173` and accepts Arena preview hosts.

| Action | Desktop | Touch |
|---|---|---|
| Move / run | WASD or arrows / Shift | Left stick / Run |
| Look | Drag world | Drag world |
| Shell-slide | Hold C | Hold Shell |
| Water Jet | Hold Space | Hold Jet |
| Dive / rise | Hold Q / E | Hold Dive / Rise |

Settings include sensitivity, invert look, reduced camera motion, sound and detail. **Remember this place** saves position; **Return to the bank** is a safe reset. The current save includes position, elapsed time and the authored watershed graph; full world persistence and offline recovery remain pending.

## Validate

```sh
npm run check
npm run build
npm run assets
BROWSER_BUNDLED=1 npm run browser
BROWSER_BUNDLED=1 npm run perf
```

Browser commands require the running dev server. `BROWSER_BUNDLED=1` uses the pinned npm-distributed Chromium fallback; alternatively use Playwright's installed browser or `BROWSER_EXECUTABLE=/path/to/chrome`. Tool binaries unpack only into temporary storage. Software-renderer timing does not establish mobile or desktop GPU performance.

Original Phase 0 evidence/tool remains historical; use the current movement browser journey for this app revision.

## Authority and evidence

1. [Operational state](OPERATIONAL_STATE.md)
2. [Build guide](docs/SQUIRTLE_FRONTIER_BUILD_GUIDE.md)
3. [Master prompt](docs/LM_ARENA_MASTER_BUILD_PROMPT.md)

[Architecture/provenance](docs/architecture/BASELINE.md) · [Phase 0 baseline](docs/performance/BASELINE.md) · [Movement QA](docs/qa/PHASE1.md) · [Asset intake](docs/assets/SQUIRTLE_INTAKE.md)

Living Frontier remains the technical foundation; Squirtle Lab supplies character source and creature-centered requirements. Both source repositories remain untouched. Supplied fan-project assets do not imply permissive distribution rights. No prototype completion or deployment is claimed.
