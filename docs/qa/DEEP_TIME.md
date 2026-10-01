# The shaft measures you back

## What changed and why

The Deep Record had the right shape and no instrument. Eight strata hung in a flooded
shaft as decorative rings, `describe(body.y)` returned one authored sentence, and nothing
about the shaft agreed with anything about the basin: the record counted years, the save
counts seconds, the floor's depth was typed twice (once into a `CylinderGeometry`, once
into a region sample). You could stand inside 800 years of it and be told nothing you
could check.

So the shaft got a measuring face, and the measurement got a single source:

- `src/simulation/deep-history.js` gained `RECORD_DEPTH = 22`, `RECORD_MATERIALS`,
  `layerThickness(eras, i)` and two pure functions: `deepTimeLedger({...})` (a
  measurement) and `recordRows(ledger)` (a presentation of that measurement). No new
  fiction: every number is either a depth, an index, a count or a difference of saved
  state.
- `src/player/deep-record.js` now derives the floor mesh and the region's sampled height
  from `RECORD_DEPTH`. `describe()` is untouched — the caption stays the era's own words.
- `index.html` / `styles.css` / `src/main.js`: one `<dl id="record-readout">` in the HUD,
  painted only while `state.place === "record"`, `pointer-events: none`, and written only
  when a string signature of the rows changes. A readout that recomputes its own DOM every
  frame would be a new kind of jank for a number that moves once a second.
- `tools/deep-time.test.mjs` (new, 10 checks) and a record leg in
  `tools/world-browser.mjs` that recomputes the ledger in Node from the page's live state
  and requires the screen to match it, row for row.

## What the readout says

At `y = −12.4` in a save that has been left to run, from the journey's own evidence
(`docs/qa/world-browser.json`):

| label                        | value                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `shaft`                      | `−12.4 m of 22`                                                                 |
| `layer`                      | `6 of 8 · 2.3 m of pale silt`                                                   |
| `recorded`                   | `about 895 years ago`                                                           |
| `basin clock`                | `9 ticks · ledger empty`                                                        |
| `water moved`                | `0.8 units of wear · 0.01 of sediment in the shallows`                          |
| `your cut`                   | `the side groove is 0.03 m deep · 0.1% of the 22 m below you`                   |
| `trend`                      | `no second entry yet`                                                           |
| `the shaft does not convert` | `record in years, basin in ticks; nothing in the water translates between them` |

At the mouth of the shaft, before the first band starts 1.5 m down, the instrument refuses
to flatter the ground you are standing on:

```
shaft:    −0.2 m of 22
layer:    bank over record · 1.3 m above the first band
recorded: the bank has no date; it is what grew on top of the record
```

That is not decoration: the eight bands tile 20.5 m of a 22 m shaft, and a readout that
assigned the top 1.5 m of bank to a stratum would be claiming a date for soil that grew on
top of the record. Standing exactly at the mouth reads `0.0 m of 22`, never `−0.0`.

Two rows are conditional and both directions are tested: `while you were here` appears
when reeds fell while your side route took supply, or when wear accumulated with nothing
cut — and it stays away when the reeds are rising. `ledger N entries over M s` appears
only once `frontier.history` has a first and a last entry.

## Standing still is the only way to read it

A shaft you can measure is still a shaft that does not know you were there, so the record
now keeps a reading. The rule lives in `advanceStrataHold(hold, ledger, vy, dt)` beside the
ledger it reads, and it is deliberately physical: time inside one band counts while
`|vy| <= STRATA_SETTLE_SPEED` (0.6 m/s), leaving the band throws the count away, moving fast
only bleeds it, and `STRATA_HOLD_SECONDS = 0.9` of that is a reading.

- `PlaceMemory.strata` (indices, not flags — eight booleans would be a wider save contract
  than the fact) with `markStrata(index, count)`: idempotent, bounds-checked, sorted.
  Hovering a band for a minute is one reading, not sixty.
- The ledger takes `read` as an input and the readout answers with `· read` / `· unread` on
  the band row plus a `record read` row: `1 of 8 bands logged`, or, before anything is
  logged, `nothing logged · hold still inside a band to read it`. The row is the tutorial;
  there is no marker, no counter in the corner, no objective.
- `RECORD_BANDS = 8` is now the single source for the generator, the save validator and the
  Memory panel's `The record is read in 1 of 8 bands, deepest the 4.` — because the panel
  cannot read it off `record.eras`, which is `null` everywhere outside the shaft.
- The caption confirms once: `… This band is logged.` for 2.5 s, then the record's own
  sentence again.
- The field is additive at v6: a save written before it existed loads with `[]`, a
  hand-edited list (`[3, 40]`, `[3, 3]`, `[1.5]`, `"0"`) is refused outright, and the
  whole-save round trip is covered in `tools/save-integrity.test.mjs`.

`browser:world` drives it the way a player would: hold the descend key to the floor of the
shaft, let go, and require the deepest band to log itself with nothing but the simulation
moving the body — no re-pinning, because a pin would prove only the pin. It then requires
band 8 from the readout (`y: -21.5` in `docs/qa/world-browser.json`), `strata.length === 1`
(not one per second), the learned index to be the band on screen, row-for-row equality with
the Node-recomputed measurement _including_ the read state, and the Memory panel to say the
same thing in prose. Before the dive the panel is asserted to claim nothing — `Nothing of
the record is logged. Hold still inside a band of it until the shaft agrees you read it.` —
because a panel that pre-fills a reading is worse than none. An earlier version of this rule
accepted an unchanged _depth reading_ instead of a band plus a steady body, which no player
could satisfy: the shaft floats you at ~6 m/s, so a hold that needs a frozen depth never
fires outside a fixture. That version is gone, and the floor path is what the ladder now
exercises, by input rather than by a pin.

The scenarios are measured, not assumed (`tools/deep-time.test.mjs`, all at `dt = 1/60`,
driving `advanceStrataHold` directly — which is also why the check below mattered):

| what the player is doing                     | result                                    |
| -------------------------------------------- | ----------------------------------------- |
| hovering still in a band                     | logs at 0.92 s                            |
| sitting on the floor of the shaft            | logs at 0.92 s                            |
| tapping Q to hold depth against the buoyancy | logs at 1.57 s                            |
| descending through the shaft at 1.5 m/s      | never                                     |
| free-rising at 6 m/s, or dropping at 6 m/s   | never                                     |
| bobbing across a band boundary               | never — the count does not transfer bands |

Two things that check taught in the open: the strict row-equality assertion caught the
harness reading `strata` from the wrong level of its own probe (a silent `undefined` would
have compared an unread ledger against a read screen forever), and a fixture that pinned the
body without holding the descend key never logged anything — the shaft refuses to record a
band it was not stood in, which is the behaviour the mechanic is made of.

## Two clocks, and the projection that was not shipped

The tempting edit was "at this rate the basin fills in N years". Rejected. `erosion` and
`sediment` are dimensionless per-tick accumulations in `src/simulation/watershed.js`; the
only length scale in the neighbourhood is `CHANNEL_DEPTH[4] = 0.22 m` over an authored
stage threshold, and using it as a metres-per-year conversion produces ~6.8e4 m/yr. The
conversion would have been invented, not measured. So the readout states exact ratios and
sums, keeps `yearsAgo` on the record side and `ticks` on the basin side, and a test fails
if any row other than the limit row mixes the two units in one value. The incomparability
is the point: you are reading a column of rock next to a column of water that is being
written while you look.

## Defects caught by building this

- **Display precision that fabricated numbers, twice.** `recordRows` printed
  `cutShare.toFixed(1)` while the ledger held `0.32`, and `depth.toFixed(1)` while the
  ledger held two decimals — numerals on screen that no measurement produced. The ledger
  now owns the rounding for both (`depth` and `cutShare` are stored at display precision),
  and the anti-fabrication check feeds it depths like `−12.367` that need rounding. The
  check is known to bite: putting `toFixed(3)` back on the ledger leaf fails it with
  `readout invented "12.4" in "shaft: −12.4 m of 22"`. The cut-share ladder is exact:
  stages 0-4 give 0, 0.1, 0.3, 0.6, 1.0 % of the 22 m below you.
- **A HUD legend that was really a checkerboard.** `styles.css:123` sets
  `dl { display: grid; grid-template-columns: 1fr 1fr }` for the existing panels, and the
  new `dl` inherited it: nine measurements laid out two columns wide, so a label and an
  unrelated value shared a line. Screenshots caught it; the readout now sets
  `display: block` with the label above its value, capped at 40ch. Desktop box 227 px wide
  ending 4 px clear of the footer band, mobile (390×844) 366 px wide above the caption.
- **A single-source depth that mattered.** With `RECORD_DEPTH` driving both the floor
  mesh and `recordRegion.sample().height`, `shaft: −12.4 m of 22` cannot disagree with the
  floor you can see; a test asserts `sample() === −22` and the strata's contiguity
  (float-tolerant: `1.5 + 3×2.3` is `8.399999999999999`, and asserting exact equality on
  seeded era depths is a trap).
- **A flaky harness, from the previous pass.** `browser:watershed` compared the water
  level read before a save click with the level read after a reload, exactly, while the
  graph kept ticking: ~1 failure in 2 runs. It now reads level and wetness in one
  evaluation and asserts the derivation (`level === waterLevelFor(wetness)`) plus a
  live-follow probe (set `wetness = 0.5`, the level moves in the same frame, set it back,
  the level returns). Three consecutive runs green.

## The pass that shipped the wrong rule, and the check that now forbids it

The hold rule described above is what the docs said and what `deep-history.js` implemented,
but the first commit of this pass wired _nothing_ to it: the follow-up patch that replaced
the loop body had anchored on text prettier had already re-flowed, so the splice silently
no-op'd and `src/main.js` kept calling its own earlier, unreachable rule. 105 unit checks,
`browser:world`, a11y and movement were all green, because every one of them passes when a
fixture pins the body — a test that tolerates both rules is not a test of either.

The fix is not "read the diff harder" (though that is how it was found, in the verification
pass after the commit). `tools/arch-check.mjs` now refuses any named import from a relative
module that is not referenced at least once more in the file: an orphaned import is exactly
the fingerprint a dead splice leaves behind, and the two orphaned symbols here were the whole
bug. Repo-wide the rule is clean at zero false positives, and it bites: aliasing one import
to an unused name fails the check with `unused import canaryUnused: src/main.js`. The same
incident also cost a `git checkout -- src/main.js` used to undo a probe, which reverted the
_fix_ along with the probe; throwaway edits belong in a `/tmp` copy, not in the working tree.

## Measured, not assumed

`deepTimeLedger` plus `recordRows` costs 5.7 µs per call measured in Node (20,000 calls,
real 8-era graph, 90-entry history): it runs once per frame in the same branch that already
built the caption, so the added work is a rounding error against a 16.6 ms frame, and the
DOM is written only when a row's string signature changes. Outside the shaft the mechanic
costs one comparison per frame (the reset when `state.place !== "record"`); inside it, a
handful of numeric tests on values already computed for the caption, and the frame after logging
a band is one signature change wide. Ordinary-run triangles are unchanged at 31,236 across
the runs that shipped this; the two recorded medians of the same build were 66.7 / 33.4 ms
and 83.3 / 50.0 ms, which is shared-CPU software-rendering noise of the kind
`OPERATIONAL_STATE.md` already refuses to interpret, not a result about this change.

`npm run check` 104/104 (90 at the start of the instrument work; +13 in `tools/deep-time.test.mjs`, +1 in `tools/save-integrity.test.mjs`). Build clean, `browser:dist` boots the
static bundle, all ten journeys green, `tools/png-diff` untouched. Triangles in an ordinary
run unchanged at 31,236 and geometries/textures at teardown 0/0 — the readout is HUD DOM,
not scene content, and it costs nothing per frame beyond a string compare. Frame medians
in `docs/performance/phase1-measured.json` move run to run under shared-CPU software
rendering and are recorded rather than interpreted; there is no hardware or mobile number.

## Still open

- The walls are drawn but faint. A probe from inside the shaft found all eight stratum
  meshes present and visible (`side: BackSide`, positioned at the band depths −1.5, −3.8,
  −6.1 …), rendering in 5 calls / 4,844 triangles with most bands frustum-culled from the
  surface; the reason a mid-shaft screenshot reads as a wash is that the scene fog is
  `#597b76` and two of the four band colours (`#607875`, `#62645c`) sit within a few
  percent of it, so the record is legible as a measurement long before it is legible as a
  wall. Making the column readable in geometry is an art pass with its own visual review,
  not a number to nudge inside this one.
- Strata remain authored canon: 8 bands, 2.3 m each. The readout now says so out loud —
  the bands tile 20.5 m of the 22 m shaft, and the 1.5 m of bank above them is reported as
  bank instead of being assigned a date.
- The cut is measured as the channel the bypass stage implies (`CHANNEL_DEPTH[stage]`),
  and the row now says so (`the side groove is 0.03 m deep`) rather than implying a hole in
  the shaft floor. It is still not a survey of the carved mesh.
- No years-per-tick conversion, no fill projection, no per-reach wear history.
- Screen-reader and real-device review, and the ten-minute objective-free enjoyment gate,
  remain unverified by anyone but a human.
