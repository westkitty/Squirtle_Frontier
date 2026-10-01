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
parse error would prove the suite runs, not that it understands. For each one it:

1. refuses to start unless the unmutated suite passes (a red suite judges nothing);
2. requires the anchor to match exactly once, so the list rots loudly (`STALE ANCHOR`)
   instead of quietly becoming a no-op — the same silent-failure class as the bug above;
3. writes the broken file, runs `node --test tools/*.test.mjs`, restores the original in a
   `finally`;
4. requires a **named failing test**, and prints which one.

Exit code is non-zero if any mutation survives, so it can gate as well as inform. The run
costs one suite pass per mutation plus one: **14 mutations in about 61 s**, measured.

## The result, not a claim

14/14 injected defects were caught by a named test. A sample of what the suite turned out to
own, with the test that fired:

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

## What it deliberately does not cover

- Anything only a browser can show: DOM, the render loop's wiring in `src/main.js`, GPU
  cost. That is the journey ladder's job, which is why the Deep Record leg earns its
  reading with input rather than by pinning the body.
- Internals that are tuning rather than promise. The wetland's relaxation time constant
  (`1 - exp(-dt / 12)`) is deliberately _not_ in the list: a survivor there would only say
  "nothing pins a number nobody documented", which is a fact about the list, not the game.
- Cross-module redundancy: each mutation names one file and one contract, so a kill tells
  you which test to trust, not merely that something failed.

Run it after changing a simulation constant, a validator bound, or a presentation number —
the classes of edit this project has actually been burned by.
