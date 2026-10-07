# Does the suite own the rule?

## Why this exists

One defect shipped through a green ladder. `src/main.js` kept running an older hold rule
after the patch meant to replace it silently no-op'd on re-flowed anchor text: 105 unit
checks, `browser:world`, a11y and movement all passed, and only reading the diff noticed.
The lesson is not "run more tests" — it is that **a suite which passes under a rule and
under its negation does not own that rule**, and there was no way to find out which of the
105 checks actually load-bear anything.

`npm run mutate` answers that by breaking the source on purpose.

## How it works

`tools/mutation-check.mjs` holds a list of textual mutations, each of which inverts or
removes one **documented** contract while leaving the file syntactically valid — a kill by
parse error would prove the suite runs, not that it understands. It copies `src`, `tools` and
the small amount of project data a unit test might read into a scratch directory in temp
storage, symlinks `node_modules`, and **never writes the repository**. For each mutation it:

1. refuses to start unless the unmutated suite passes in the copy (a red suite judges nothing,
   and this also proves the unit tests are hermetic to those paths);
2. requires the anchor to match exactly once, so the list rots loudly (`STALE ANCHOR`) instead
   of quietly becoming a no-op — the same silent-failure class as the bug above;
3. breaks the copy, runs `node --test tools/*.test.mjs` there, restores the copy;
4. requires a **named failing test**, and prints which one.

Exit code is non-zero if any mutation survives, so it can gate as well as inform. Runtime cost
scales with the registry because the harness executes one unmutated baseline plus one suite run
per mutation. The original 14-mutation timing below is historical; the 2026-10-06 Phase 1
baseline executes **80 registered mutations**.

## Why it breaks a copy instead of the working tree

The first version mutated `src/*.js` in place and repaired it in a `finally`, plus signal
handlers for good measure. Interrupting it proved the handlers useless — a `SIGINT` that
arrives while the process is blocked in the synchronous suite call cannot run any JavaScript
of ours, and the tree was left holding a genuinely broken `src/simulation/deep-history.js`.
A journal in temp storage and a recovery pass fixed the next-run case and still leaked the
dirty-file window.

Copying first removes the hazard class instead of managing it: the worst an interrupt can do
is leave a scratch directory in temp storage, and a run sweeps stale `sf-mutation-*`
directories older than an hour on startup (older than that, nothing of ours can legitimately
be in flight). The repository is not a thing this tool can corrupt, which is a stronger
property than "it cleans up after itself".

## The result, not a claim

At the 2026-10-06 Phase 1 baseline, **80/80 injected defects were caught by a named test**.
The table below is the original small sample retained to explain what mutation ownership means,
with the test that fired:

| injected defect                                          | caught by                                                         |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| depth leaf keeps two decimals while the screen shows one | no number reaches the readout that was not measured in the ledger |
| the bank above the first band is claimed as a stratum    | the shaft's mouth is measured, not described                      |
| the hold counts only while the body is moving            | reading a band takes standing in it, and falling through does not |
| a saved strata list is trusted without bounds            | learning a band is idempotent, bounded and saved                  |
| the basin level is anchored on the wrong wetland supply  | an undisturbed basin sits exactly on the line it has always used  |
| the painted shallows flood the walkable rim              | the gullies answer to the basin, and so does the cut you made     |
| drink tracks recorded from anywhere                      | drink tracks record what was seen here, capped and validated      |

The first run found one survivor, and it was a real gap in the tests rather than in the
game: turning `WATER_PAINT_LIFT` from 1.5 cm into 5 cm changed nothing, because the
existing check asserted `WATER_SURFACE_Y(level) - WATER_SHORELINE(level) ===
WATER_PAINT_LIFT + WATER_SHORE`, an identity that holds for **any** pair of constants. The
contract worth keeping — the lift is 1.5 cm, the rim is 5 cm, the lift stays smaller than
the rim, and the lift is measured from the surface — is now asserted by name in
`tools/water-level.test.mjs` ("the paint may shimmer, but never wider than the rim it sits
on"), and that mutation is now killed. Suite total went 105 → 106.

## Redesign authority — 2026-10-06

Mutation tests own **current documented contracts**, not historical behavior forever.

The accepted body-first redesign deliberately supersedes several prior contracts:
- Current Sense as a required input/UI/discovery mechanic;
- named-reach diagnosis as ordinary player information;
- the amber ripple as required guidance;
- watershed repair as the opening/core player loop;
- exact Water Jet pulse/cooldown/body-yaw interaction behavior where it conflicts with the later traversal/manipulation redesign;
- exact shell friction, step threshold, braking, speed-cap and camera-coupling tuning where later movement work intentionally replaces them.

When implementation reaches one of these contracts:

1. identify every mutation and named test that encodes the superseded rule;
2. add replacement coverage for the new player-facing invariant first;
3. then retire or rewrite the obsolete mutation/test;
4. never weaken a test merely because current code fails it;
5. preserve simulation/persistence/resource invariants that remain authoritative.

A mutation kill proves the suite owns a rule. It does **not** prove the rule is still the correct product design.

Browser journeys that claim a player journey must ultimately exercise it through player-available controls. Fixture teleportation or direct state injection may remain for setup/isolation, but must be labeled as such and cannot prove that the equivalent human control path is usable.

## Body-first Phase 2 authority transition — 2026-10-06

Current Sense is no longer an active runtime contract. The source/unit suite now contains **273 checks**: the Phase 2 replacement authority plus matched-performance regressions that protect counterbalanced ordering, ambiguity handling, fixed workload identity, exact sample windows, semantic-start identity, fixed per-render simulation cadence, and direct update+render work-duration sampling that excludes RAF scheduling/vsync idle after retiring the one reach-line presentation assertion that existed only to protect the superseded named-reach overlay. The obstruction presentation tests were rewritten in place to protect ordinary physical debris visibility and response instead of amber ripple / flow-mote behavior.

The mutation registry remains **80 contracts**. The former "Current Sense invents Shucker evidence" mutation was not discarded; its real invariant survived the redesign and is now named **"Shucker evidence appears without active Shucker state."** The replacement ecology test proves that evidence and nearby hide/flee behavior require real Shucker pressure, independent of any scanner.

Browser authority changed accordingly: watershed proof now covers physical obstruction, player-input Jet interaction, derived shoreline change and save/reload reconstruction without Sense; world proof confirms the Memory panel no longer exposes reach traces/mouths or live water telemetry; Squirtle social proof uses actual actor behavior rather than Sense messages.

## What it deliberately does not cover

- Anything only a browser or human can show: DOM, render-loop wiring, GPU cost, camera
  comfort or movement enjoyment. Browser journeys own deterministic user-path behavior;
  humans own pleasure and comfort. A journey must not use fixture movement to claim
  usability of a path a human must physically perform.
- Internals that are tuning rather than promise. The wetland's relaxation time constant
  (`1 - exp(-dt / 12)`) is deliberately _not_ in the list: a survivor there would only say
  "nothing pins a number nobody documented", which is a fact about the list, not the game.
- Cross-module redundancy: each mutation names one file and one contract, so a kill tells
  you which test to trust, not merely that something failed.

Run it after changing a simulation constant, a validator bound, or a presentation number —
the classes of edit this project has actually been burned by.
