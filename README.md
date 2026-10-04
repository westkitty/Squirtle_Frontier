# Squirtle Frontier

A systemic browser game in development where **you directly control Squirtle, not a trainer**.

## Current slice

**Early playable frontier: Stillwater Reach, the Listening Basin and Deep Record.** Walk/run, swim/dive, shell-slide and Water Jet around a small streamed proving ground. No quest checklist is required. The authored pond is still not the full terrain-derived watershed.

Technical movement, browser, asset and lifecycle checks pass. **The Phase 1 quality gate remains open**: ten-minute human enjoyment, actual hardware performance, touch usability and audio review are not verified. The user has waived approval gates for continued implementation. Phase 2 semantic hydrology is in progress; its saved graph now drives pond current/tint and nearby Water Jet debris clearing. Hold F (or touch Sense) in water to locate the disturbance. Repair now propagates to wetland growth, aggregate prey/predators, a settlement trough and delayed Lab basin colonization. The stone doorway on the western bank leads to the Lab. Rest near the wooden platform inside (R or contextual button) to let five minutes pass through the same simulation. A flooded Deep Record shaft is reached by diving to the centre of the Lab basin and pressing R; down there a measurement column tells you which of 22 metres of strata you are standing in, what the water has worn since the save began, and that the record's years and the basin's seconds do not
convert; hold one band of strata still for a moment and the shaft logs that you read it,
in the save. Weather changes source flow; lightning can ignite a bounded eastern-bank fire patch and rain washes ash downstream. Water Jet suppresses fire or opens the western side groove, which diverts flow away from the wetland. The side groove’s saved stages now carve bounded local terrain and update body/camera contact; only its overlapping chunk is rebuilt at finer resolution. Memory shows only surveyed cells and known places; a marked Lab frog can acquire persistent familiarity. Nearby wetland prey now forage and flee from Squirtle and stalking predators. The water-house caretaker remembers visits, withdraws from alarming movement, and leaves a cistern-fed bowl after sustained calm contact. Art and navigation remain provisional.

## Run

```sh
npm ci
npm start
```

Vite binds to `0.0.0.0:5173` and accepts Arena preview hosts.

| Action            | Desktop                | Touch                     |
| ----------------- | ---------------------- | ------------------------- |
| Move / run        | WASD or arrows / Shift | Left stick / Run          |
| Look              | Drag world             | Drag world                |
| Shell-slide       | Hold C                 | Hold Shell                |
| Water Jet         | Hold Space             | Hold Jet                  |
| Dive / rise       | Hold Q / E             | Hold Dive / Rise          |
| Current Sense     | Hold F in water        | Hold Sense                |
| Enter / leave Lab | R near doorway         | Contextual doorway button |

Settings include sensitivity, invert look, reduced camera motion, sound and detail. **Remember this place** saves position; **Return to the bank** is a safe reset. Near wildlife is behavioural, not a
population model: thirst drives the herd to a shore the world actually reports as
wet, and fouled or dried shallows stop the drinking instead of silently thinning
the animals. Where you have seen them drink is logged in Places remembered.

The basin's inflows are named too. Hold Current Sense anywhere on a channel and it
says which one you are on and how far above the shallows that is, and Places
remembered lists the routes you have actually stood on. Nothing here is simulated
twice: the water still follows the watershed graph, and only the groove you cut is
carved terrain. The basin itself now has a level, so clearing the landslide raises the
shoreline and opens the side groove lowers it again: the same water the herd drinks at,
the same edge you start swimming at, and the reach map colours itself by which gullies
are actually holding water. Version 6 saves include location, watershed, ecological state and wall time. Return simulates up to six hours using the same regional tick as active play; old saves migrate without retroactive catch-up. A malformed primary can load its backup read-only without overwriting the original. Conflicting stale-tab saves are rejected. Settings add adaptive resolution (pixel budget only, never simulation) and tri-state camera motion. Saving records the full body pose per place, so a reload resumes mid-dive in the basin instead of dropping the body onto land. Storage writes are serialized with Web Locks when the browser offers them; a tab that loses the write race is told so and can adopt the newer generation in place rather than reloading blind. Export, validated import and explicit backup restoration remain available. Replacements validate first and preserve prior bytes in one local quarantine slot. Export before replacing if you need multiple external backups. Locking serializes tabs on this browser only; there is no cross-device sync.

## Validate

```sh
npm run check
npm run mutate
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
BROWSER_BUNDLED=1 npm run browser:multitab
```

Browser commands require the running dev server. `BROWSER_BUNDLED=1` uses the pinned npm-distributed Chromium fallback; alternatively use Playwright's installed browser or `BROWSER_EXECUTABLE=/path/to/chrome`. Tool binaries unpack only into temporary storage. Software-renderer timing does not establish mobile or desktop GPU performance. `npm run mutate` breaks each documented contract in turn and requires a named test to notice, so a green suite can be shown to own the rules it claims ([test authority](docs/qa/TEST_AUTHORITY.md)).

Original Phase 0 evidence/tool remains historical; use the current movement browser journey for this app revision.

## Authority and evidence

1. [Operational state](OPERATIONAL_STATE.md)
2. [Build guide](docs/SQUIRTLE_FRONTIER_BUILD_GUIDE.md)
3. [Master prompt](docs/LM_ARENA_MASTER_BUILD_PROMPT.md)

[Test authority](docs/qa/TEST_AUTHORITY.md) · [Architecture/provenance](docs/architecture/BASELINE.md) · [Phase 0 baseline](docs/performance/BASELINE.md) · [Movement QA](docs/qa/PHASE1.md) · [Asset intake](docs/assets/SQUIRTLE_INTAKE.md)

Living Frontier remains the technical foundation; Squirtle Lab supplies character source and creature-centered requirements. Both source repositories remain untouched. Supplied fan-project assets do not imply permissive distribution rights. No prototype completion or deployment is claimed.

## Hidden Squirtle population

Stillwater now has a bounded same-species ecology: Marsh and Urban Squirtles can project into valid current-slice habitat, Freshwater remains rarer, while Saltwater and Deepwater are implemented but intentionally habitat-ineligible until the world contains a real coast/estuary or naturally deep flooded region. Nearby Squirtles are behavioral actors, not quests or enemies; meaningful individuals can become remembered, Current Sense can read genuine same-species traces, ordinary humans range from ignoring to protecting despite the law, and rare Shucker pressure creates a distinct species-level danger signal. The player remains the existing untyped Squirtle; no canonical player ecotype is assigned.
