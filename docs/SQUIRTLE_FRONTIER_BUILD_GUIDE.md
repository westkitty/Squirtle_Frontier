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

> You are Squirtle. You are small. The frontier is enormous. Water is how you move, sense, understand, and repair a living world that continues changing when you leave.

The final game should create awe through causal depth rather than through sheer asset density.

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
    current-sense.js
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

# PART V — PHASE 2: BUILD ONE WATERSHED

## 16. Add semantic hydrology

Do not build global fluid physics.

Represent the watershed as a graph/state system.

Each water node/segment should be able to track:
- source;
- downstream links;
- flow;
- capacity;
- blockage;
- wetness;
- contamination;
- sediment;
- temperature class;
- salinity where relevant;
- seasonal modifier;
- active/inactive channel;
- restoration state.

## 17. Generate watercourses from terrain

At world generation:
1. identify high points/sources;
2. trace downhill routes;
3. select tributaries;
4. build confluences;
5. assign ponds/wetlands;
6. determine settlement water relationships;
7. create local render splines/meshes;
8. persist the semantic topology separately from presentation.

## 18. Local water rendering

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

## 19. Current Sense

Current Sense should interpret simulation state, not reveal arbitrary quest markers.

Possible signals:
- ash/fire;
- disturbed sediment;
- blood/injury;
- pollen/vegetation;
- sewage/runoff;
- salt;
- cold mineral spring;
- unusual heat;
- storm debris;
- nearby migration.

Interaction:
1. enter water or touch a source;
2. hold/activate Current Sense;
3. camera/audio simplify;
4. directional ripple cues appear;
5. nearby/upstream semantic sources are ranked;
6. player follows the strongest clue physically.

Ensure every signal is grounded in actual world state.

## 20. One repairable hydrology problem

Create exactly one full vertical slice:

Example:
- landslide blocks a tributary;
- downstream wetland dries;
- settlement cistern declines;
- prey distribution changes;
- Lab basin receives less flow.

Player can:
- discover blockage;
- inspect alternate channel;
- use Water Jet;
- move small debris;
- create a starter groove;
- trigger a semantic channel transition.

The simulation then propagates the change.

## 21. Staged erosion

Represent erosion as discrete states:
- dry depression;
- damp groove;
- trickle;
- cut channel;
- established creek.

Transitions should depend on:
- water flow;
- slope;
- soil class;
- vegetation stabilization;
- time.

Each state swaps/rebuilds local terrain/water presentation.

## 22. Phase 2 gate

Prove:
- hydrology graph persists;
- local water reflects semantic state;
- repair can change downstream state;
- change survives save/load;
- no global fluid simulation exists;
- visual result reads naturally without debug UI.

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

# PART XII — PHASE 9: WORLD REPAIR

## 43. Repair verbs

Build repair around physical/systemic acts:
- clear blockage;
- initiate new channel;
- restore pond;
- extinguish fire;
- rinse contamination;
- reconnect wetland;
- carry/redistribute seed;
- restore cistern;
- reopen culvert;
- stabilize bank.

## 44. Avoid binary morality

Every intervention may have second-order effects.

Examples:
- restore pond -> more prey -> more predators;
- reroute water -> settlement improves -> downstream wetland loses flow;
- extinguish all fire -> fuel accumulates;
- create crossing -> humans establish route.

Do not label outcomes `GOOD` or `BAD`.

## 45. Repair must propagate

At least one intervention must visibly affect:
1. local environment;
2. another downstream/upstream location;
3. ecology;
4. settlement;
5. Lab.

If all consequences happen at the interaction site, the design thesis has failed.

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
- storm runoff creates temporary Current Sense signals.

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

## 61. Current Sense accessibility

Current Sense must not depend only on subtle color/ripple differences.

Provide:
- audio;
- motion;
- shape;
- optional text cue in accessibility mode.

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
- Current Sense;
- watershed propagation;
- channel transitions;
- repair persistence;
- Lab colonization;
- notable actor promotion;
- save/recovery;
- offline fast-forward.

## 70. Browser journey

Automate a representative journey:
1. boot;
2. move on land;
3. enter water;
4. dive;
5. Water Jet;
6. shell slide;
7. Current Sense;
8. cross chunks;
9. discover blockage;
10. repair channel;
11. save;
12. reload;
13. advance/return;
14. verify downstream ecology;
15. enter Lab;
16. verify basin response;
17. inspect Deep Record;
18. exit Lab;
19. verify no console/page errors.

## 71. Visual QA

Capture and inspect:
- Squirtle close camera;
- forest scale;
- swimming;
- underwater;
- shell slide;
- Current Sense;
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
2. Land, swim/dive, shell slide, and Water Jet each feel distinct.
3. Creature-scale camera makes ordinary terrain feel large.
4. One semantic watershed exists.
5. Current Sense reads real world state.
6. One hydrology repair can be performed physically.
7. The repair propagates downstream over simulation time.
8. Ecology visibly responds.
9. A settlement visibly responds.
10. A Lab basin visibly responds.
11. Save/load preserves the causal chain.
12. Offline fast-forward advances it correctly.
13. At least one notable creature can persist across encounters.
14. The Deep Record has one explorable historical slice.
15. Streaming and repeated transitions settle without resource growth.
16. Desktop performance meets the defined threshold.
17. Mobile-class behavior is measured or explicitly marked unknown.
18. No unexplained console/page errors remain.
19. A human tester can understand one major world change without debug numbers.
20. Movement remains fun when no objective is active.

If any of items 1–12 fail, production expansion is blocked.

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
- watersheds matter mechanically;
- repair creates second-order consequences;
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
