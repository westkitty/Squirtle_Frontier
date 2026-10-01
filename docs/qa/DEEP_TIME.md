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
| `your cut`                   | `0.03 m of floor · 0.1% of the 22 m below you`                                  |
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

## Measured, not assumed

`deepTimeLedger` plus `recordRows` costs 5.7 µs per call measured in Node (20,000 calls,
real 8-era graph, 90-entry history): it runs once per frame in the same branch that already
built the caption, so the added work is a rounding error against a 16.6 ms frame, and the
DOM is written only when a row's string signature changes.

`npm run check` 101/101 (was 90; +11 here). Build clean, `browser:dist` boots the
static bundle, all ten journeys green, `tools/png-diff` untouched. Triangles in an ordinary
run unchanged at 31,236 and geometries/textures at teardown 0/0 — the readout is HUD DOM,
not scene content, and it costs nothing per frame beyond a string compare. Frame medians
in `docs/performance/phase1-measured.json` move run to run under shared-CPU software
rendering and are recorded rather than interpreted; there is no hardware or mobile number.

## Still open

- Strata remain authored canon: 8 bands, 2.3 m each. The readout now says so out loud —
  the bands tile 20.5 m of the 22 m shaft, and the 1.5 m of bank above them is reported as
  bank instead of being assigned a date.
- The cut is measured as floor height (`CHANNEL_DEPTH[stage]`), not as a carved mesh:
  `your cut` reports the channel the stage implies, not a survey of the hole.
- No years-per-tick conversion, no fill projection, no per-reach wear history.
- Screen-reader and real-device review, and the ten-minute objective-free enjoyment gate,
  remain unverified by anyone but a human.
