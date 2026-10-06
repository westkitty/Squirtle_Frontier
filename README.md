# Squirtle Frontier

A systemic browser game in development where **you directly control Squirtle, not a trainer**.

## Current slice

**Early playable frontier: Stillwater Reach, the Listening Basin and Deep Record.** Walk/run, swim/dive, shell-slide and Water Jet around a small streamed proving ground. No quest checklist is required.

**Body-first redesign accepted 2026-10-06.** The target game is now explicitly organized around **movement → encounter → curiosity → consequence**. Hydrology, ecology, settlements, weather/fire and persistence remain valuable background machinery, but the player is not expected to diagnose or maintain those systems.

**Phase 2 removes Current Sense from active play.** There is no F/X/touch sensing ability, amber guidance ripple, Sense-only flow-mote overlay, named-reach diagnosis, or live watershed telemetry in the ordinary player interface. The semantic watershed remains internal background state that drives water, ecology, settlements and persistent consequences.

The Phase 1 quality gate remains open: objective-free ten-minute human movement enjoyment, actual hardware performance, human touch usability and heard audio are not verified. That gate is again the controlling prerequisite for larger-map or major-system expansion.

The existing slice also includes the Lab, five-minute rest/fast-forward, the Deep Record, weather/fire, staged channel terrain, persistent ecology, nearby wildlife, caretaker memory/bowl behavior, projected Squirtles, versioned saves and offline return. These systems are being retained so they can produce visible consequences and encounters around a better Squirtle body rather than becoming player-facing simulation homework.

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
| Enter / leave Lab | R near doorway         | Contextual doorway button |

Settings include sensitivity, invert look, reduced camera motion, sound and detail.

Current Sense has been retired rather than rebound to a different feature. **Remember this place** saves position; **Return to the bank** is a safe reset. Near wildlife is behavioural, not a
population model: thirst drives the herd to a shore the world actually reports as
wet, and fouled or dried shallows stop the drinking instead of silently thinning
the animals. Where you have seen them drink is logged in Places remembered.

The saved hydrology still drives basin level, wetness, channel state, ecology and offline consequences, but those systems are background authority rather than a diagnostic loop. The current slice exposes their effects through ordinary world state such as physical obstruction geometry, changing shoreline, water appearance, stream foam/audio, ecology and actor behavior rather than a special perception mode. The same derived basin level continues to govern the shore the herd drinks at and the edge where swimming begins. Version 6 saves include location, watershed, ecological state and wall time. Return simulates up to six hours using the same regional tick as active play; old saves migrate without retroactive catch-up. A malformed primary can load its backup read-only without overwriting the original. Conflicting stale-tab saves are rejected. Settings add adaptive resolution (pixel budget only, never simulation) and tri-state camera motion. Saving records the full body pose per place, so a reload resumes mid-dive in the basin instead of dropping the body onto land. Storage writes are serialized with Web Locks when the browser offers them; a tab that loses the write race is told so and can adopt the newer generation in place rather than reloading blind. Export, validated import and explicit backup restoration remain available. Replacements validate first and preserve prior bytes in one local quarantine slot. Export before replacing if you need multiple external backups. Locking serializes tabs on this browser only; there is no cross-device sync.

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

## Living Squirtle population

Stillwater now has a bounded same-species ecology: Marsh and Urban Squirtles can project into valid current-slice habitat, Freshwater remains rarer, while Saltwater and Deepwater are implemented but intentionally habitat-ineligible until the world contains a real coast/estuary or naturally deep flooded region. Nearby Squirtles are behavioral actors, not quests or enemies; meaningful individuals can become remembered, and that persistent memory is now surfaced alongside real same-species signs in the Places remembered panel. Same-species traces, ordinary human reactions, legal escalation and rare Shucker pressure remain simulation foundations. Their player-facing evidence now comes from actual nearby Squirtles, behavior, persistent memory and world changes rather than Sense-only telemetry, a combat faction or a quest log. The player remains the existing untyped Squirtle; no canonical player ecotype is assigned.
