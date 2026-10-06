# Squirtle Frontier — Exhaustive Build Guide

## 0. Mission

Build a third-person systemic open-world browser game where the player directly controls Squirtle.

The project must combine:
- the persistent, simulated, streaming open world of `westkitty/The_Living_Frontier`;
- the Squirtle model, close-range interaction philosophy, habitat thinking, camera intimacy, and character-centered presentation direction of `westkitty/Squirtle_Lab`.

This is not:
- an Eevee/Squirtle reskin;
- a trainer game;
- a conventional quest RPG;
- a collection of disconnected authored rooms;
- a tech demo;
- a fluid-simulation research project.

The core fantasy is:

> You are Squirtle. You are small. The frontier is enormous. Moving through it should be pleasurable before the game asks anything else of you. You notice creatures, places and physical changes because the world makes them interesting; the simulation works underneath those experiences rather than becoming homework.

The final game should create awe through causal depth rather than through sheer asset density.

### Body-first product hierarchy

The controlling order is:

1. **Movement** — scamper, shell, swim, dive and Water Jet must be enjoyable without objectives.
2. **Encounter** — wildlife, other Squirtles, humans, structures, weather and events give movement somewhere interesting to lead.
3. **Curiosity** — physical world cues should create questions before UI explains answers.
4. **Consequence** — persistent systems make places visibly different because of earlier actions.

**Simulation is allowed to be complicated internally. Playing Squirtle is not.**

Current Sense, named-reach diagnosis, the amber disturbance ripple and watershed repair as an opening objective are superseded design contracts. They may remain in the current runtime until later phases remove or demote them, but no new system may depend on them.

---

# PART I — SOURCE-OF-TRUTH PREPARATION

## 1. Verify repository identity

Before changing code:

1. Confirm the active repository is exactly:
   `westkitty/Squirtle_Frontier`
2. Confirm the active branch.
3. Read:
   - `OPERATIONAL_STATE.md`
   - this guide
   - `docs/LM_ARENA_MASTER_BUILD_PROMPT.md`
4. Inspect Git status.
5. Record current HEAD.
6. Do not modify:
   - `westkitty/The_Living_Frontier`
   - `westkitty/Squirtle_Lab`
   unless separately authorized.

## 2. Inspect the two source projects

### 2.1 The Living Frontier

Inspect at minimum:
- `README.md`
- `OPERATIONAL_STATE.md`
- `package.json`
- `asset-policy.json`
- `index.html`
- `styles.css`
- `src/main.js`
- `src/loop.js`
- `src/player.js`
- `src/worldgen.js`
- `src/worldstate.js`
- `src/streaming.js`
- `src/terrain.js`
- `src/veg.js`
- `src/entities.js`
- `src/interaction.js`
- `src/persistence.js`
- `src/save-recovery.js`
- `src/cartography.js`
- `src/map-ui.js`
- `src/audio.js`
- `src/history.js`
- `src/deeprecord.js`
- `src/assets/**`
- all relevant `tools/*.mjs`
- `docs/resources/**`

Create an internal architecture map covering:
- simulation authority;
- render/update loop;
- terrain streaming;
- actor lifecycle;
- asset management;
- world state;
- persistence;
- UI;
- weather/fire;
- ecology;
- settlements/factions;
- history/deep record;
- test and performance tooling.

### 2.2 Squirtle Lab

Inspect at minimum:
- `OPERATIONAL_STATE.md`
- `docs/EEVEE_LAB_CHARACTER_RECONSTRUCTION_HANDOFF.md`
- `docs/SQUIRTLE_ASSET_INTAKE.md`
- `docs/LM_ARENA_SQUIRTLE_LAB_BUILD_PROMPT.md`
- `assets/source/squirtle/Archive.zip`

Inspect the ZIP contents and determine:
- usable source format;
- armature/skeleton;
- animation clips;
- texture maps;
- normal vs shiny textures;
- scale;
- axis/orientation;
- model origin;
- material count;
- whether conversion to GLB is required.

Do not invent animation semantics from filenames alone.

## 3. Establish the architecture fork strategy

The default technical decision is:

**Fork/adapt The Living Frontier architecture into Squirtle Frontier.**

Do not attempt to bolt The Living Frontier into Squirtle Lab.

Reason:
- Living Frontier already owns streamed terrain, ecology, persistence, offline time, settlements, factions, weather, fire, cartography, and asset lifecycle.
- Squirtle-specific systems are more safely added as a player/controller/presentation specialization than open-world systems are added to a room-based habitat project.

Document any deviation before implementing it.

---

# PART II — REPOSITORY FOUNDATION

## 4. Reconstruct a clean project skeleton

Create or adapt a layout approximately like:

```
index.html
styles.css
package.json
OPERATIONAL_STATE.md
README.md

assets/
  runtime/
    squirtle/
    creatures/
    humans/
    structures/
  source/
    squirtle/
  textures/
  icons/

docs/
  SQUIRTLE_FRONTIER_BUILD_GUIDE.md
  LM_ARENA_MASTER_BUILD_PROMPT.md
  architecture/
  assets/
  qa/
  performance/

src/
  main.js
  loop.js
  rng.js
  settings.js
  worldgen.js
  worldstate.js
  streaming.js
  terrain.js
  veg.js
  structures.js
  entities.js
  interaction.js
  persistence.js
  save-recovery.js
  history.js
  deeprecord.js
  cartography.js
  map-ui.js
  audio.js
  ui.js
  uikit.js

  player/
    squirtle-controller.js
    squirtle-movement.js
    squirtle-swim.js
    shell-slide.js
    water-jet.js
    creature-camera.js
    body-state.js

  hydrology/
    watershed.js
    channels.js
    water-state.js
    water-render.js
    sediment.js
    contamination.js
    repair.js

  micro/
    micro-topology.js
    culverts.js
    burrows.js
    root-tunnels.js
    underwater-passages.js

  lab/
    lab-manager.js
    basin-state.js
    colonization.js
    lab-render.js
    home-interactions.js

  memory/
    creature-memory.js
    notable-actor-registry.js
    place-memory.js

  assets/
    AssetManager.js
    playable-creature-adapter.js
    animation-runtime.js

tools/
  smoke-test.mjs
  arch-check.mjs
  shader-check.mjs
  ui-check.mjs
  visit-test.mjs
  perf-probe.mjs
  squirtle-movement-test.mjs
  hydrology-test.mjs
  watershed-propagation-test.mjs
  lab-colonization-test.mjs
  streaming-lifecycle-test.mjs
  asset-manifest-check.mjs
  asset-gltf-validate.mjs
```

Preserve source-project conventions where possible rather than inventing unnecessary abstractions.

## 5. Establish explicit module ownership

Define authority clearly:

- `worldstate`: canonical persistent simulation state.
- `streaming`: active chunk ownership.
- `terrain`: terrain presentation only.
- `hydrology`: semantic water simulation and local water presentation inputs.
- `player/*`: Squirtle movement/control state.
- `entities`: nearby live wildlife/humans only.
- `lab/*`: Lab rendering and frontier-to-Lab state projection.
- `memory/*`: persistent notable relationships and place memory.
- `assets/*`: runtime asset loading, caching, instance ownership, disposal.
- `ui`: DOM presentation; never gameplay authority.
- `audio`: one coherent WebAudio graph.

No imported GLB node may become gameplay authority.

---

# PART III — PHASE 0: PROVE THE FOUNDATION

## 6. Port only the minimum Living Frontier substrate

Bring across enough verified architecture to boot:

1. renderer;
2. camera host;
3. input normalization;
4. game loop;
5. deterministic RNG;
6. one streamed terrain chunk;
7. world state;
8. settings;
9. persistence skeleton;
10. asset manager;
11. semantic DOM HUD shell.

Do not port all content yet.

## 7. Establish the performance baseline before adding Squirtle

Measure:
- boot time;
- first interactive frame;
- renderer.info memory counts;
- renderer.info render counts;
- FPS/frame-time;
- JS heap where available;
- chunk load/unload;
- repeated traversal memory stability.

Store baseline under:
`docs/performance/BASELINE.md`

No feature phase may delete performance evidence.

---

# PART IV — PHASE 1: MAKE SQUIRTLE FEEL GOOD

This is the most important production phase.

Do not proceed to world complexity if this fails.

## 8. Prepare the Squirtle runtime asset

1. Preserve original source ZIP.
2. Convert to GLB only if required.
3. Preserve provenance.
4. Validate geometry.
5. Validate materials.
6. Validate textures.
7. Inspect animation clips.
8. Normalize scale.
9. Normalize forward axis.
10. Normalize root/origin.
11. Confirm browser load.
12. Confirm repeated instantiate/release behavior.
13. Confirm no shared mutable material state leaks between instances.
14. Record runtime hash.
15. Add asset manifest entry.

## 9. Create a `PlayableCreature` boundary

Define a creature adapter exposing semantic capabilities such as:
- root group;
- movement presentation hooks;
- animation states;
- surface contact points;
- shell state;
- swim state;
- dive state;
- Water Jet origin;
- head/look target;
- interaction target;
- body bounds;
- visual material variants.

Squirtle implementation lives behind this interface.

The world simulation must not know Pokémon-specific mesh names.

## 10. Land locomotion

Implement:
- idle;
- walk;
- run/scamper;
- turn;
- acceleration/deceleration;
- grounded checks;
- slope handling;
- step handling;
- collision;
- jump only if body design supports it coherently;
- animation blending;
- footstep surface audio.

Tune controller dimensions for Squirtle's actual body.

## 11. Swimming

Swimming must be a distinct controller state.

Implement:
- water detection;
- buoyancy target;
- surface swim;
- dive;
- ascent;
- underwater pitch;
- bank/turn;
- current influence;
- exit-to-land transitions;
- camera transitions;
- animation transitions;
- underwater audio;
- surface splash.

Never reuse land friction parameters underwater.

## 12. Shell slide

Implement a physically legible but bounded shell-slide system:
- enter shell;
- initial impulse;
- downhill acceleration;
- friction by surface class;
- bank/steer;
- collision response;
- impact VFX/audio;
- minimum/maximum controllability;
- safe recovery from stuck states;
- exit shell;
- water entry transition;
- accessibility alternative for high-frequency steering.

Do not make it a fully realistic rigid-body simulation if that harms control.

## 13. Water Jet movement

Implement Water Jet primarily as traversal.

Support:
- directional impulse;
- underwater boost;
- surface launch;
- uphill assist;
- shell-slide chaining;
- splash/foam;
- sound;
- cooldown or bounded stamina-like constraint if needed for level design.

Do not turn it into a projectile-combat hotbar.

## 14. Creature-scale camera

The camera must make the world feel enormous.

Implement:
- low default eye line;
- near-body framing;
- slope anticipation;
- water-surface transition;
- underwater transition;
- shell-slide anticipation;
- collision avoidance;
- look sensitivity;
- reduced-motion option;
- touch camera;
- desktop mouse camera.

## 15. Phase 1 gate

Do not proceed until:
- Squirtle loads reliably;
- land movement feels responsive;
- water feels materially different from land;
- shell slide is enjoyable;
- Water Jet movement works;
- camera supports all modes;
- repeated mode transitions do not leak resources;
- desktop browser smoke passes;
- touch controls are usable;
- a human can play for ten minutes with no objective and still enjoy movement.

---

# PART V — PHASE 2: REMOVE DIAGNOSTIC GAMEPLAY AND DEMOTE THE WATERSHED

## 16. Preserve semantic hydrology as background infrastructure

Do not delete useful hydrology merely because it stops being a player-facing objective.

Preserve semantic state where it earns its cost:
- water levels;
- wetness;
- flow;
- sediment;
- contamination;
- staged channel state;
- ecology/settlement dependencies;
- offline consequences;
- persistence.

Do not build global fluid physics.

The strict player-facing rule is:

> The watershed may influence the world. It may not dictate what the player must do.

**Phase 2 implementation status (2026-10-06):** the active control/UI/runtime scanner path is removed. The obstruction remains physical; shoreline/water presentation, stream effects/audio, ecology, settlements, persistence and offline advancement continue to consume background state.

## 17. Make watercourses physically legible

Terrain and water presentation should communicate local conditions directly.

Use physical cues such as:
- visible flow direction;
- foam/drift;
- pooling upstream of blockage;
- downstream dryness;
- mud/sediment;
- vegetation condition;
- animal drinking behavior;
- altered shorelines;
- current force on the body.

Do not require graph terminology or named-reach telemetry for ordinary play.

## 18. Local water rendering must communicate without a sensing mode

Use:
- simple surface meshes;
- flow UVs;
- foam near obstacles;
- particles only near the player;
- waterfall strips;
- mist where appropriate;
- underwater fog;
- depth color;
- reflection/refraction only within budget.

Flow presentation should remain readable when Current Sense is absent.

## 19. Current Sense is retired

Body-first Phase 2 removed Current Sense from active gameplay. Keep the following surfaces absent:
- keyboard/touch/gamepad Sense bindings;
- status-line hydrology diagnosis;
- named-reach dependency in ordinary play;
- Sense-only flow motes;
- amber disturbance ripple;
- Sense-only conspecific or Shucker telemetry.

Preserve useful underlying simulation facts and expose them through ordinary world state where they still matter; do not restore a scanner or diagnostic equivalent.

Examples:
- flow direction -> surface motion, foam, drifting debris, current force, leaning vegetation;
- blockage -> visible obstruction, upstream pooling, downstream dryness, sediment;
- contamination/ash -> coloration, particulates, deposits;
- conspecific/Shucker traces -> physical evidence and actor behavior.

Text may remain as accessible reinforcement, but important local state must not be unknowable without a special diagnostic mode.

## 20. Convert hydrology repair into optional physical interaction

The existing landslide/blockage may remain as one environmental interaction, but it is no longer the assigned opening loop.

The player should be able to:
- notice a physical obstruction without a diagnostic button;
- manipulate it through ordinary Squirtle abilities;
- receive immediate visible/audio confirmation;
- leave and later notice a persistent consequence.

Do not require the player to understand the watershed graph.

## 21. Preserve staged erosion only where it creates visible consequence

Staged erosion remains a lightweight implementation technique.

Possible stages:
- dry depression;
- damp groove;
- trickle;
- cut channel;
- established creek.

Keep a stage only if it changes what the player can see, traverse, hear, or encounter.

## 22. Phase 2 gate — world readability without diagnostic UI

Prove:
- the game remains readable without Current Sense or a renamed diagnostic equivalent;
- background hydrology persists and remains valid through save/load/offline return;
- at least one physical action produces an immediate readable response;
- at least one later consequence is visible without debug or diagnostic UI;
- no global fluid simulation exists;
- the body-first Phase 1 movement gate remains the controlling prerequisite for major expansion.

---

# PART VI — PHASE 3: CREATURE-SCALE MICROTOPOLOGY

## 23. Add micro-route sockets to chunks

Each chunk may deterministically generate:
- hollow logs;
- root arches;
- burrow entrances;
- culverts;
- drainage pipes;
- gaps under structures;
- underwater tunnels;
- shoreline crawlspaces.

Use biome/structure/terrain context.

## 24. Separate generic and authored microspaces

Generic:
- inexpensive modular pieces;
- deterministic;
- used for traversal variety.

Authored:
- unique caves;
- settlement cisterns;
- buried ruins;
- Deep Record entrances;
- Lab access;
- special underwater routes.

## 25. Micro-route performance rules

- never generate a full second terrain layer;
- only create nearby microgeometry;
- unload with parent chunk;
- use collision proxies cheaper than visual geometry;
- reuse materials;
- instance repeated modules;
- measure traversal memory after repeated chunk cycling.

---

# PART VII — PHASE 4: ECOLOGY FROM SQUIRTLE SCALE

## 26. Preserve aggregate distant ecology

Use regional values for:
- prey;
- predators;
- forest health;
- forage;
- water access;
- fire damage;
- contamination;
- wetland quality.

Spawn live actors near the player based on these values.

## 27. Add water dependencies

Tie population models to:
- drinking access;
- wetland area;
- water quality;
- seasonal flow;
- fire;
- settlement pressure.

## 28. Promote notable individuals only

Most actors remain ephemeral.

Promote an actor to persistent identity when:
- encountered repeatedly;
- photographed repeatedly;
- fed/helped;
- wounded/saved;
- involved in rare event;
- enters the Lab;
- becomes ecologically significant.

Persist:
- semantic identity;
- species;
- markings/variant seed;
- relationship state;
- last region;
- notable memories;
- alive/dead/unknown state.

## 29. Relationship memory

Squirtle can develop:
- familiarity;
- fear;
- curiosity;
- tolerance;
- avoidance;
- rivalry.

Keep this behavioral and bounded.

Do not create RPG affinity bars unless needed for accessibility/debug.

---

# PART VIII — PHASE 5: HUMAN SCALE FROM A SMALL CREATURE

## 30. Reframe settlement interaction

Squirtle does not accept conventional text quests.

Communicate settlement state through:
- empty troughs;
- stopped millwheels;
- dry fields;
- smoke;
- broken infrastructure;
- human gestures;
- bowls left outside;
- doors closed/opened;
- attempts to chase/follow/feed Squirtle;
- environmental sound.

Dialogue may exist, but Squirtle is not a standard conversational protagonist.

## 31. Human recognition

Settlements track familiarity with Squirtle.

Possible responses:
- curiosity;
- tolerated presence;
- feeding;
- fear;
- hostility;
- accommodation;
- infrastructure adapted to Squirtle-scale access.

Do not turn this into faction reputation copied from the human game.

## 32. Emergent customs

Only after the core game is stable, allow repeated observed behaviors to create bounded settlement customs:
- water bowls;
- ramps;
- catchment basins;
- shell marks;
- firebreak ponds.

These are derived state transitions, not unconstrained generative culture simulation.

---

# PART IX — PHASE 6: THE HYDROLOGICAL LAB

## 33. Build the Lab as home, not menu

The Lab is an abandoned research facility reached through a submerged or creature-scale route.

Start with:
- central cistern;
- one active basin;
- sleeping/rest area;
- object interaction area;
- one entry/exit route.

## 34. Frontier-to-Lab projection

Each basin references frontier state.

Possible inputs:
- upstream water quality;
- wetland health;
- species presence;
- seeds;
- contamination;
- hydrologic connectivity.

The Lab should not copy the entire outside ecosystem.

It should interpret it.

## 35. Colonization system

Example eligibility chain:
- hydrologic connection restored;
- reed seeds available;
- water quality above threshold;
- reeds establish;
- insects increase;
- frog colonization becomes possible.

Use delayed probabilistic colonization with deterministic seeded outcomes where possible.

No unlock screen.

The player notices life arriving.

## 36. Home interaction

Because the player is Squirtle, adapt close interaction to self-directed animal behavior:
- sleep;
- rest;
- swim;
- play;
- manipulate small objects;
- stack/push objects;
- choose favorite resting places;
- approach trusted humans/creatures for affection;
- withdraw into shell;
- inspect recovered artifacts.

---

# PART X — PHASE 7: MEMORY AND CARTOGRAPHY

## 37. Preserve player-surveyed cartography

Map only what Squirtle has actually explored.

Visibility should depend on:
- terrain;
- height;
- weather;
- darkness;
- water depth where relevant.

## 38. Add Squirtle place memory

Record meaningful places:
- favorite pond;
- recurring food site;
- attack site;
- safe den;
- known shortcut;
- human feeding site;
- damaged/restored location.

Represent memory subtly through map notation, behavior, or route preference.

Do not turn it into hundreds of map icons.

## 39. Trails and creature routes

Retain Living Frontier-style ground memory.

Squirtle movement can contribute to:
- tiny repeated paths;
- muddy slide tracks;
- shoreline wear;
- repeated entry routes.

NPCs need not automatically use Squirtle-scale paths unless physically plausible.

---

# PART XI — PHASE 8: THE DEEP RECORD

## 40. Preserve deterministic deep history

Reuse/adapt Living Frontier's deep historical model.

## 41. Physicalize the record

Create a vertical flooded borehole beneath/near the Lab.

Map historical eras into:
- sediment layers;
- ruins;
- material strata;
- water chemistry;
- archaeological fragments;
- old channels.

The player learns history by descending/swimming through it.

## 42. Keep history computationally cheap

Do not persist 1,400 years of individual actors.

Persist/generate:
- era summaries;
- settlement occupancy;
- endings;
- hydrologic changes;
- faction/structural events;
- major disasters.

Render only the currently explored depth.

---

# PART XII — PHASE 9: PERSISTENT CONSEQUENCE

## 43. Physical actions and persistent consequences

Use existing Squirtle abilities and world systems to create consequential interactions:
- move or wash debris;
- extinguish fire;
- rinse contamination;
- open or close a physical route;
- alter a wet/dry area;
- disturb or calm wildlife;
- create a repeated route or shoreline trace.

The player does not need a repair checklist or moral score.

## 44. Avoid binary morality

Every intervention may have second-order effects.

Examples:
- more water -> more prey -> more predators;
- reroute water -> one area improves while another dries;
- extinguish all fire -> fuel accumulates;
- create crossing -> humans establish route.

Do not label outcomes `GOOD` or `BAD`.

## 45. Consequences must propagate visibly

At least one prototype action must visibly affect:
1. its immediate physical site; and
2. one later state the player can notice without diagnostic UI.

That later state may be hydrology, ecology, settlement, Lab, another Squirtle, route availability, vegetation, fire/ash, shoreline, or another persistent world expression.

If all consequence exists only as scalar state or status text, the design thesis has failed.

---

# PART XIII — PHASE 10: WONDER EVENTS

## 46. Build systemic events before scripted spectacle

Candidate events:
- flash flood;
- drought;
- wildfire;
- first snow;
- migration;
- lake drawdown revealing ruins;
- restored-species return;
- storm-created temporary route;
- ancient spring reopening.

Each event should derive from simulation thresholds where possible.

## 47. Make events traversal problems

The player's body should matter.

Examples:
- flooded creek becomes high-speed water route;
- ice changes shell friction;
- drought opens cave;
- wildfire changes air visibility and water demand;
- storm runoff creates temporary visible currents, debris lines or routes.

---

# PART XIV — PHASE 11: AUDIO AND PRESENTATION

## 48. Water-led procedural audio

Use one AudioContext.

Drive sound by:
- flow;
- depth;
- substrate;
- enclosure;
- rainfall;
- wind;
- contamination;
- wildlife;
- settlement activity.

## 49. Shell acoustics

Surface-specific shell contact:
- stone tick;
- mud scrape;
- wooden dock knock;
- wet rock skid;
- underwater resonance;
- rain on shell.

## 50. Threat audio

Use layered intensity rather than simple battle-music toggles.

Threat may derive from:
- predator proximity;
- fire;
- flood force;
- hostile humans;
- low visibility.

## 51. Visual direction

Squirtle:
- readable stylized/cel-shaded presentation;
- clean silhouette;
- expressive animation.

World:
- atmospheric;
- large-scale;
- wet;
- naturalistic-stylized;
- dense through silhouette/instancing rather than brute-force meshes.

Avoid:
- generic Pokémon UI imitation;
- giant blue gradients;
- glass-dashboard styling;
- visual clutter over the world;
- overuse of outlines on terrain.

---

# PART XV — PHASE 12: PERFORMANCE HARDENING

## 52. Budgets

Establish explicit budgets for:
- draw calls;
- triangles;
- active actor count;
- active particle count;
- shadow casters;
- texture memory;
- runtime asset bytes;
- per-chunk geometry;
- boot transfer;
- save size;
- offline simulation duration.

Use The Living Frontier's measured baselines as starting evidence, not eternal limits.

## 53. Performance scenarios

Measure:
- dense forest;
- settlement;
- storm;
- wildfire;
- underwater;
- shell-slide at speed;
- rapid chunk traversal;
- Lab;
- Lab <-> frontier transition;
- long session;
- repeated save/load;
- repeated chunk cycling.

## 54. Mobile-class validation

Do not claim mobile viability from desktop emulation alone.

At minimum validate:
- coarse pointer layout;
- touch controls;
- orientation changes;
- narrow viewport;
- sustained performance on representative mobile-class hardware when available.

If real-device evidence is unavailable, mark it unknown.

## 55. Lifecycle test

Repeat:
1. traverse multiple chunks;
2. enter/leave Lab;
3. dive/surface repeatedly;
4. trigger effects;
5. reload;
6. inspect renderer/resource counts.

Counts should settle rather than climb indefinitely.

---

# PART XVI — PHASE 13: SAVE, RECOVERY, AND OFFLINE WORLD

## 56. Versioned save schema

Persist semantic state only.

Include:
- world seed;
- Squirtle position/state;
- surveyed map;
- watershed state;
- ground memory;
- fire scars;
- ecology aggregates;
- settlements;
- factions if retained;
- Lab basin state;
- colonization;
- notable actors;
- place memories;
- history/chronicle;
- settings references;
- repair actions;
- active wonder-event state if necessary.

## 57. Conservative recovery

Preserve Living Frontier's philosophy:
- quarantine damaged saves when possible;
- recover sections independently;
- clearly report what survived;
- do not claim unknown data survived;
- never silently reset the entire world because one section failed.

## 58. Offline fast-forward

Advance:
- ecology;
- settlements;
- hydrology;
- colonization;
- weather summaries;
- repair consequences.

Do not simulate near-frame physics offline.

Generate a homecoming report based on actual changed state.

---

# PART XVII — PHASE 14: ACCESSIBILITY AND INPUT

## 59. Input parity

Support:
- keyboard/mouse;
- touch;
- optional gamepad only if properly validated.

## 60. Accessibility

Require:
- visible focus;
- semantic DOM UI;
- adequate touch targets;
- reduced motion;
- camera sensitivity;
- invert-look;
- audio controls;
- detail presets;
- input-remapping path if feasible;
- readable text at mobile widths;
- no critical information conveyed only by color.

## 61. Environmental readability and accessible reinforcement

Important world conditions must not depend on one subtle visual channel.

Provide multiple signals where appropriate:
- audio;
- motion;
- shape/silhouette;
- material/state change;
- optional concise text reinforcement.

Accessibility support may explain what the world is showing, but it should not recreate a hidden diagnostic mechanic.

---

# PART XVIII — PHASE 15: CLEAN-BUILD ARCHITECTURE

## 62. Protect the simulation from IP coupling

Maintain:

```
World Simulation
      |
PlayableCreature API
      |
  +---+----------------+
  |                    |
Squirtle            Original
Fan Presentation    Clean Presentation
```

No world system should require:
- Pokémon names;
- Squirtle-specific mesh node names;
- copyrighted texture paths;
- franchise-specific constants.

## 63. Asset policy

For non-Squirtle assets:
- preserve exact provenance;
- prefer permissive commercial-friendly terms;
- self-host runtime assets;
- hash source/runtime files;
- verify browser redistribution;
- keep source and runtime manifests.

Do not silently copy random web assets.

---

# PART XIX — PRODUCTION EXPANSION AFTER PROTOTYPE PASS

Do not start this section until the prototype gate passes.

## 64. Expand world regions

Add biome and watershed diversity gradually.

Each new region must prove:
- unique traversal;
- hydrologic identity;
- ecological identity;
- one repair opportunity;
- one wonder event;
- performance stability.

## 65. Expand Lab basins

Only add a new basin when it corresponds to a meaningful frontier system.

Do not build 50 decorative rooms because Squirtle Lab used a 50-room structure.

For Squirtle Frontier, the open world is the primary world.

The Lab should be smaller, denser, and deeply reactive.

## 66. Expand notable wildlife

Add species only when they create:
- ecological function;
- traversal interaction;
- threat;
- relationship opportunity;
- visual/auditory identity.

## 67. Expand human settlements

Add settlements only when they create different relationships with:
- water;
- ecology;
- Squirtle;
- infrastructure;
- conflict.

---

# PART XX — TEST STRATEGY

## 68. Static/architecture checks

Verify:
- no gameplay authority in imported model nodes;
- one loop;
- no unbounded timers;
- no remote runtime asset URLs unless explicitly allowed;
- no scene serialization in save data;
- Squirtle IP isolated behind adapter.

## 69. Focused behavioral tests

Cover:
- movement state transitions;
- water entry/exit;
- shell slide;
- Water Jet;
- camera collision/recovery;
- background watershed propagation where retained;
- channel transitions where retained;
- visible consequence persistence;
- wildlife/conspecific/human encounter state;
- Lab/Deep Record continuity;
- save/recovery;
- offline fast-forward.

Tests that pin superseded Current Sense behavior, amber-ripple guidance, watershed-as-objective behavior, or old exact movement tuning must be retired or rewritten only after replacement coverage exists.

## 70. Browser journey

Automate representative **human-shaped** journeys. A journey that claims a player path must use player-available controls for that path; fixture teleportation or direct state injection may isolate setup but may not prove usability.

Core traversal journey:
1. boot;
2. move on land;
3. shell slide;
4. Water Jet;
5. physically enter water;
6. swim;
7. dive/rise;
8. return to land;
9. rotate/look near obstacles;
10. save/reload;
11. verify no console/page errors and no resource growth.

Consequence journey:
1. approach an environmental interaction through normal movement;
2. perform the physical action;
3. receive immediate visible feedback;
4. leave/rest/advance;
5. return;
6. verify one persistent visible consequence without Current Sense or debug UI.

Encounter journey:
1. approach wildlife or another actor quietly;
2. approach with faster/noisier movement;
3. use Jet or shell nearby;
4. verify distinct visible behavioral responses.

## 71. Visual QA

Capture and inspect:
- Squirtle close camera;
- forest scale;
- swimming;
- underwater;
- shell slide;
- environmental readability without diagnostic UI;
- settlement from Squirtle height;
- storm;
- fire aftermath;
- Lab basin;
- Deep Record.

Source inspection is not visual QA.

---

# PART XXI — PROTOTYPE DEFINITION OF DONE

The prototype passes only when all of these are true:

1. Squirtle is directly playable.
2. Scamper, shell slide, swim, dive/rise and Water Jet each feel distinct.
3. A human can move for ten objective-free minutes on real hardware and voluntarily repeat movement verbs.
4. Creature-scale camera supports movement without geometry trapping or unwanted steering.
5. Important nearby environmental conditions are understandable without Current Sense, named-reach telemetry, a quest checklist or debug numbers.
6. At least one wildlife, human or Squirtle encounter visibly responds to how the player moves or acts.
7. At least one ordinary physical action produces immediate readable feedback.
8. At least one later persistent consequence of player action can be noticed physically after leaving/resting/returning.
9. Background hydrology/ecology/weather/fire state, where retained, remains coherent and persists without becoming player homework.
10. Save/load and offline fast-forward preserve the world.
11. Lab/Deep Record continuity remains stable if those areas are included in the slice.
12. Streaming and repeated transitions settle without resource growth.
13. Desktop hardware performance is measured against the defined threshold.
14. Mobile-class behavior is measured or explicitly marked unknown.
15. Human touch usability and heard audio are reviewed or explicitly remain open.
16. No unexplained console/page errors remain.
17. Browser journeys claiming player behavior perform the claimed control path without teleporting around the mechanic under test.

Production expansion is blocked if the body-first movement gate, camera/control gate, world-readability gate, persistence/lifecycle gate or required hardware evidence remains failed or unverified.

---

# PART XXII — LM ARENA EXECUTION RULES

## 72. Work in bounded phases

LM Arena must:
- read project authority first;
- inspect source repos before copying architecture;
- implement one phase at a time;
- validate each phase;
- commit only coherent passing work;
- update `OPERATIONAL_STATE.md`;
- never claim unrun tests;
- never fabricate device evidence.

## 73. Avoid quota waste

Do not:
- repeatedly rescan entire repos;
- rewrite plans already stored here;
- ask for information available in the repos;
- generate massive speculative asset catalogs;
- refactor unrelated source architecture;
- run full suites after every tiny edit.

Use:
1. targeted inspection;
2. focused implementation;
3. focused tests;
4. integration test;
5. broader checks at phase gates.

## 74. Repair limit

For each phase:
- one primary implementation pass;
- one bounded repair pass after failed validation;
- if still blocked, stop and report the earliest unresolved failure with evidence.

Do not thrash.

## 75. Git discipline

At each successful phase:
1. inspect diff;
2. verify authorized scope;
3. update state/docs if necessary;
4. stage intended files;
5. commit clearly;
6. push without force.

Never rewrite history.

---

# PART XXIII — FINAL PRODUCTION DEFINITION OF DONE

The full project is complete only when:

- Squirtle is the playable protagonist;
- movement is excellent;
- open-world simulation remains persistent;
- background hydrology creates visible mechanical consequences without becoming player homework;
- optional physical interactions can create persistent second-order consequences;
- ecology, settlements, and Lab react;
- the world changes while the player is away;
- notable creature relationships persist;
- mapping reflects actual exploration;
- Deep Record physicalizes history;
- performance remains within measured budgets;
- asset provenance is complete;
- save recovery is robust;
- accessibility is validated;
- browser journeys pass;
- rendered QA passes;
- repository state is clean;
- final commit is pushed;
- public deployment is only claimed after live verification.

The game succeeds emotionally when the player can return to a river, wetland, village, trail, or Lab basin and recognize:

> I remember what happened here.

The game succeeds technically when that recognition comes from persistent systemic state rather than a scripted fake.
