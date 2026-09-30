# Squirtle Frontier

A systemic browser game in development where **you directly control Squirtle, not a trainer**.

## Current slice

**Early causal slice: Stillwater Reach and the Listening Basin.** Walk/run, swim/dive, shell-slide and Water Jet around a small streamed proving ground. No quest checklist is required. The authored pond is still not the full terrain-derived watershed.

Technical movement, browser, asset and lifecycle checks pass. **The Phase 1 quality gate remains open**: ten-minute human enjoyment, actual hardware performance, touch usability and audio review are not verified. The user has waived approval gates for continued implementation. Phase 2 semantic hydrology is in progress; its saved graph now drives pond current/tint and nearby Water Jet debris clearing. Hold F (or touch Sense) in water to locate the disturbance. Repair now propagates to wetland growth, aggregate prey/predators, a settlement trough and delayed Lab basin colonization. The stone doorway on the western bank leads to the Lab. Buildings and animals remain procedural placeholders.

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
| Current Sense | Hold F in water | Hold Sense |
| Enter / leave Lab | R near doorway | Contextual doorway button |

Settings include sensitivity, invert look, reduced camera motion, sound and detail. **Remember this place** saves position; **Return to the bank** is a safe reset. Version 3 saves include location, watershed, ecological state and wall time. Return simulates up to six hours using the same regional tick as active play; old saves migrate without retroactive catch-up. A malformed primary can load its backup read-only without overwriting the original. Conflicting stale-tab saves are rejected. Recovery/export UI and transactional multi-tab locking remain pending.

## Validate

```sh
npm run check
npm run build
npm run assets
BROWSER_BUNDLED=1 npm run browser
BROWSER_BUNDLED=1 npm run perf
BROWSER_BUNDLED=1 npm run browser:watershed
BROWSER_BUNDLED=1 npm run browser:habitat
```

Browser commands require the running dev server. `BROWSER_BUNDLED=1` uses the pinned npm-distributed Chromium fallback; alternatively use Playwright's installed browser or `BROWSER_EXECUTABLE=/path/to/chrome`. Tool binaries unpack only into temporary storage. Software-renderer timing does not establish mobile or desktop GPU performance.

Original Phase 0 evidence/tool remains historical; use the current movement browser journey for this app revision.

## Authority and evidence

1. [Operational state](OPERATIONAL_STATE.md)
2. [Build guide](docs/SQUIRTLE_FRONTIER_BUILD_GUIDE.md)
3. [Master prompt](docs/LM_ARENA_MASTER_BUILD_PROMPT.md)

[Architecture/provenance](docs/architecture/BASELINE.md) · [Phase 0 baseline](docs/performance/BASELINE.md) · [Movement QA](docs/qa/PHASE1.md) · [Asset intake](docs/assets/SQUIRTLE_INTAKE.md)

Living Frontier remains the technical foundation; Squirtle Lab supplies character source and creature-centered requirements. Both source repositories remain untouched. Supplied fan-project assets do not imply permissive distribution rights. No prototype completion or deployment is claimed.
