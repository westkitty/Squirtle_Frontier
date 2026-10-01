# Squirtle Frontier

A systemic browser game in development where **you directly control Squirtle, not a trainer**.

## Current slice

**Early playable frontier: Stillwater Reach, the Listening Basin and Deep Record.** Walk/run, swim/dive, shell-slide and Water Jet around a small streamed proving ground. No quest checklist is required. The authored pond is still not the full terrain-derived watershed.

Technical movement, browser, asset and lifecycle checks pass. **The Phase 1 quality gate remains open**: ten-minute human enjoyment, actual hardware performance, touch usability and audio review are not verified. The user has waived approval gates for continued implementation. Phase 2 semantic hydrology is in progress; its saved graph now drives pond current/tint and nearby Water Jet debris clearing. Hold F (or touch Sense) in water to locate the disturbance. Repair now propagates to wetland growth, aggregate prey/predators, a settlement trough and delayed Lab basin colonization. The stone doorway on the western bank leads to the Lab. Rest near the wooden platform inside (R or contextual button) to let five minutes pass through the same simulation. A flooded Deep Record shaft is reached by diving to the centre of the Lab basin and pressing R. Weather changes source flow; lightning can ignite a bounded eastern-bank fire patch and rain washes ash downstream. Water Jet suppresses fire or opens the western side groove, which diverts flow away from the wetland. The side groove’s saved stages now carve bounded local terrain and update body/camera contact; only its overlapping chunk is rebuilt at finer resolution. Memory shows only surveyed cells and known places; a marked Lab frog can acquire persistent familiarity. Nearby wetland prey now forage and flee from Squirtle and stalking predators. The water-house caretaker remembers visits, withdraws from alarming movement, and leaves a cistern-fed bowl after sustained calm contact. Art and navigation remain provisional.

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

Settings include sensitivity, invert look, reduced camera motion, sound and detail. **Remember this place** saves position; **Return to the bank** is a safe reset. Version 5 saves include location, watershed, ecological state and wall time. Return simulates up to six hours using the same regional tick as active play; old saves migrate without retroactive catch-up. A malformed primary can load its backup read-only without overwriting the original. Conflicting stale-tab saves are rejected. Settings add adaptive resolution (pixel budget only, never simulation), tri-state camera motion, and export, confirmed import and explicit backup restoration. Replacements validate first and preserve prior bytes in one local quarantine slot. Export before replacing if you need multiple external backups. Atomic multi-tab locking remains pending.

## Validate

```sh
npm run check
npm run build
npm run assets
BROWSER_BUNDLED=1 npm run browser
BROWSER_BUNDLED=1 npm run perf
BROWSER_BUNDLED=1 npm run browser:watershed
BROWSER_BUNDLED=1 npm run browser:habitat
BROWSER_BUNDLED=1 npm run browser:world
BROWSER_BUNDLED=1 npm run browser:recovery
BROWSER_BUNDLED=1 npm run browser:channel
BROWSER_BUNDLED=1 npm run browser:wildlife
BROWSER_BUNDLED=1 npm run browser:a11y
BROWSER_BUNDLED=1 npm run browser:dist
```

Browser commands require the running dev server. `BROWSER_BUNDLED=1` uses the pinned npm-distributed Chromium fallback; alternatively use Playwright's installed browser or `BROWSER_EXECUTABLE=/path/to/chrome`. Tool binaries unpack only into temporary storage. Software-renderer timing does not establish mobile or desktop GPU performance.

Original Phase 0 evidence/tool remains historical; use the current movement browser journey for this app revision.

## Authority and evidence

1. [Operational state](OPERATIONAL_STATE.md)
2. [Build guide](docs/SQUIRTLE_FRONTIER_BUILD_GUIDE.md)
3. [Master prompt](docs/LM_ARENA_MASTER_BUILD_PROMPT.md)

[Architecture/provenance](docs/architecture/BASELINE.md) · [Phase 0 baseline](docs/performance/BASELINE.md) · [Movement QA](docs/qa/PHASE1.md) · [Asset intake](docs/assets/SQUIRTLE_INTAKE.md)

Living Frontier remains the technical foundation; Squirtle Lab supplies character source and creature-centered requirements. Both source repositories remain untouched. Supplied fan-project assets do not imply permissive distribution rights. No prototype completion or deployment is claimed.
