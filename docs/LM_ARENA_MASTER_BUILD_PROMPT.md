# LM Arena Master Build Prompt — Squirtle Frontier

You are the primary implementation agent for:

https://github.com/westkitty/Squirtle_Frontier

Your task is to build **Squirtle Frontier** as a production-quality browser game by executing the repository's authoritative staged build guide.

## 1. Read project authority first

Before planning or editing, read in this order:

1. `OPERATIONAL_STATE.md`
2. `docs/SQUIRTLE_FRONTIER_BUILD_GUIDE.md`
3. this file
4. `README.md`

Then inspect the two read-only source projects:

- https://github.com/westkitty/The_Living_Frontier
- https://github.com/westkitty/Squirtle_Lab

Do not modify either source project.

Use The Living Frontier as the primary technical/systemic substrate.
Use Squirtle Lab for Squirtle assets, creature-specific interaction/presentation, habitat concepts, and relevant character systems.

Do not rewrite the build guide into another plan. It already is the plan.

## 2. Product definition

The player directly controls Squirtle.

There is:
- no trainer avatar;
- no conventional monster-catching loop;
- no generic RPG quest structure;
- no fake open world made of menus;
- no global fluid simulation.

The game must combine:
- pleasurable Squirtle-specific locomotion;
- creature-scale exploration;
- streaming open-world terrain;
- persistent ecology;
- semantic watershed/hydrology simulation;
- world repair with second-order consequences;
- settlements that visibly respond;
- a Hydrological Lab that reacts to frontier state;
- notable creature relationships;
- actual exploration-based cartography;
- offline world evolution;
- a physicalized Deep Record of historical layers;
- robust persistence/recovery;
- performance appropriate for browser delivery.

The emotional target is causal awe:

> The player returns somewhere and understands that the world is different because of what happened there earlier.

## 3. Protected architectural decisions

Unless repository evidence proves a change is necessary, preserve these decisions:

- The Living Frontier is the engine foundation.
- Gameplay authority remains outside imported model nodes and animation.
- One authoritative main loop.
- Distant ecology is aggregate data; nearby important actors become scene objects.
- Simulation scale and rendering scale are separate.
- Water uses semantic watershed state plus local presentation, not global fluid physics.
- Erosion uses staged semantic transitions, not global destructible terrain.
- Squirtle IP-specific presentation sits behind a `PlayableCreature` adapter.
- Runtime assets are self-hosted.
- The full frontier and detailed Lab are not rendered simultaneously.
- Squirtle's runtime model remains cached across normal transitions.
- Save state stores semantics, not serialized Three.js scenes.
- No force pushes or history rewrites.

## 4. Work phase-by-phase

Use the exact staged ordering in `docs/SQUIRTLE_FRONTIER_BUILD_GUIDE.md`.

Do not jump to production-scale content.

The first major objective is the **prototype gate**.

The representative slice must prove:

1. Squirtle direct control.
2. Distinct land movement.
3. Swimming and diving.
4. Shell slide.
5. Water Jet traversal.
6. Creature-scale camera.
7. One semantic watershed.
8. Current Sense grounded in actual world state.
9. One physical hydrology repair.
10. Downstream ecological propagation.
11. Visible settlement response.
12. Visible Lab basin response.
13. Save/load preservation.
14. Offline fast-forward preservation.
15. One persistent notable creature.
16. One explorable Deep Record slice.
17. Stable streaming/resource lifecycle.
18. Measured performance.

Production expansion is BLOCKED until the mandatory prototype criteria pass.

## 5. First implementation sequence

Start with these steps and do not skip their validation:

### A. Repository baseline
- verify repo identity and branch;
- inspect Git status and HEAD;
- read source-project architecture;
- create project skeleton using Living Frontier conventions;
- preserve source provenance;
- establish test and performance tooling;
- record a baseline.

### B. Engine substrate
Port/adapt only the minimum Living Frontier systems needed to boot:
- renderer;
- input;
- authoritative loop;
- RNG;
- world state;
- streaming;
- one terrain region;
- settings;
- persistence skeleton;
- asset manager;
- semantic DOM UI shell.

Prove boot and chunk lifecycle before adding feature breadth.

### C. Squirtle asset
Inspect the Squirtle source bundle from Squirtle Lab.

Determine:
- appropriate source file;
- rig;
- clips;
- texture assignments;
- scale;
- orientation;
- browser runtime conversion.

Create a validated runtime asset while preserving original provenance.

Do not assign animation meanings that were not verified.

### D. PlayableCreature seam
Implement the adapter defined by the guide.

World/gameplay systems must not depend on Pokémon-specific mesh names.

### E. Movement vertical slice
Implement and tune:
- land movement;
- swimming;
- diving;
- shell slide;
- Water Jet traversal;
- creature-scale camera;
- touch controls.

Do not proceed to systemic-world complexity until movement is genuinely playable.

### F. Performance checkpoint
Measure:
- frame time;
- renderer resource counts;
- chunk transitions;
- repeated movement-mode transitions;
- asset lifecycle.

Repair leaks before continuing.

### G. One watershed
Implement:
- semantic water graph;
- local water rendering;
- Current Sense;
- one blockage;
- one alternate channel;
- staged erosion/channel formation;
- one downstream wetland/settlement effect;
- persistence.

### H. Lab response
Implement one Lab basin connected to the watershed.

Prove the frontier repair can eventually change the Lab basin through actual simulation state.

### I. Offline return
Save, advance world time, reload/return, and prove the causal chain remains coherent.

### J. Prototype gate
Run every gate in the guide.
Do not promote the project to broad production if mandatory evidence is missing.

## 6. Squirtle movement quality bar

Do not accept "functional" locomotion as sufficient.

Squirtle must feel body-specific.

Land:
- acceleration and weight appropriate to Squirtle;
- grounded contact;
- slope response;
- readable animation.

Water:
- clearly superior aquatic mobility;
- buoyancy;
- dive/ascent;
- current influence;
- distinct camera/audio.

Shell slide:
- momentum;
- surface friction;
- slope acceleration;
- steering/banking;
- collision response;
- reliable recovery.

Water Jet:
- directional traversal impulse;
- underwater boost;
- surface launch;
- traversal chaining;
- bounded use where necessary.

The prototype must remain enjoyable for at least ten minutes without objectives.

## 7. Hydrology implementation rule

Never solve hydrology through globally simulated particles.

Use:
- watershed topology;
- scalar state;
- graph propagation;
- staged presentation;
- local shader/VFX interpretation.

A river "moving" may mean:
- channel state changes;
- an alternate spline activates;
- wetness masks change;
- vegetation changes;
- ecology updates;
- settlement dependencies update.

The player must see believable consequences without requiring physically exact fluid computation.

## 8. Repair rules

Repair is not a quest-completion button.

The player should physically participate using Squirtle's body and abilities.

At least one intervention in the prototype must affect:
- interaction site;
- downstream/upstream hydrology;
- ecology;
- settlement;
- Lab.

Avoid binary moral scoring.
Second-order consequences are desirable.

## 9. Ecology rules

Preserve abstract distant simulation.

Only promote notable individuals when justified.

Do not assign persistent identity to every spawned animal.

Notable individuals may be promoted through:
- repeated encounters;
- rescue/help;
- injury;
- rare event;
- repeated photography;
- Lab entry;
- ecological importance.

## 10. Lab rules

The Hydrological Lab is a physical place and home environment.

It is not a menu hub.

Frontier state may influence:
- basin water quality;
- vegetation;
- insect presence;
- amphibian presence;
- debris;
- contamination;
- colonization.

Colonization should occur through simulated eligibility/time, not achievement popups.

## 11. Deep Record rules

Use deterministic aggregate history.

Do not simulate centuries of individuals.

Physicalize selected history through:
- sediment;
- ruins;
- old channels;
- material layers;
- water conditions;
- explorable depth.

## 12. Asset rules

For Squirtle:
- preserve supplied source archive;
- preserve provenance;
- keep franchise-specific presentation isolated.

For all other external assets:
- verify exact source;
- verify license;
- verify browser redistribution;
- self-host;
- record source/runtime hashes;
- do not use mystery assets or remote runtime hotlinks.

Reuse validated Living Frontier assets only when their provenance and terms remain valid for this project.

## 13. Performance rules

Treat performance as a feature.

Maintain explicit budgets for:
- draw calls;
- triangles;
- active actors;
- particles;
- shadows;
- texture memory;
- runtime bytes;
- chunk resources;
- save size.

Test representative scenarios:
- forest;
- settlement;
- underwater;
- storm;
- fire;
- high-speed shell slide;
- rapid streaming;
- Lab;
- Lab/frontier transition;
- long-session cycling.

Desktop emulation does not prove mobile performance.

If real-device evidence is unavailable, state that clearly.

## 14. Validation escalation

For every phase:

1. syntax/static checks;
2. focused behavioral tests;
3. relevant integration/runtime check;
4. browser journey;
5. performance/lifecycle where affected;
6. rendered screenshot inspection where presentation changed;
7. broader suite only at phase gates or when evidence demands it.

Use one bounded repair pass after failed validation.

If still blocked, stop that phase and report:
- earliest unresolved failure;
- evidence;
- affected requirement;
- safest next action.

Do not thrash.

## 15. Git behavior

The user authorizes repository implementation, staging, commits, and pushes to:

`westkitty/Squirtle_Frontier`

Before every commit:
- inspect the changed-file set;
- exclude unrelated changes;
- update `OPERATIONAL_STATE.md` when project truth changes;
- run the appropriate validation.

Then:
1. stage intended files;
2. commit with a precise message;
3. push without force.

Do not modify source repositories.
Do not force-push.
Do not rewrite history.

## 16. Evidence discipline

Never claim:
- a test passed unless it ran;
- a browser path works unless exercised;
- visual QA passed unless rendered output was inspected;
- performance is acceptable without measurement;
- mobile support without appropriate evidence;
- a deployment works unless the live route was opened and checked.

Maintain evidence states accurately:
- requested;
- implemented-unverified;
- verified;
- failed;
- unknown;
- pending.

## 17. Progress reporting

Keep progress reports compact.

At each meaningful checkpoint report:
- phase;
- what changed;
- validation result;
- commit SHA if committed;
- blocker if one exists.

Do not paste huge logs or repeat the build guide.

## 18. Completion

Do not call the project complete merely because:
- Squirtle renders;
- movement works;
- one region exists;
- the prototype gate passes.

A prototype pass authorizes production expansion; it does not prove the full game complete.

The final definition of done is in `docs/SQUIRTLE_FRONTIER_BUILD_GUIDE.md`.

## Begin

Read the repository authority files and both source projects.

Then begin Phase 0 and the minimum engine substrate.

Continue through the next coherent gate without asking the user to repeat information already present in the repositories.

Stop only for:
- a genuine external capability/credential blocker;
- a failed mandatory gate that remains unresolved after one bounded repair pass;
- a decision whose alternatives cannot be resolved from project evidence without changing the product contract.

Otherwise, implement, validate, stage, commit, push, update operational state, and continue phase-by-phase.
