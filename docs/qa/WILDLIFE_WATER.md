# Wildlife and water (thirst, drinking, drink tracks)

Animals now have a reason to move that the player can read: they go where the
water is, and they refuse to go where it is not fit. No population number changed —
`Ecosystem` remains the sole authority on how many animals exist, so this layer is
legibility rather than a second survival model.

## The rule

Thirst rises 0.09 per second per animal. Above 0.55 a prey animal walks to a shore
(0.55 m/s) and commits to a 2.2 s drink, quenching at 0.35 per second. A shore is
usable only when all three hold: the world's own water predicate says there is
water at that point, the wetland node is above 0.25 wetness, and
`(1 - contamination) * (1 - sediment / 2)` is above 0.5. When thirst passes 0.85
and nothing qualifies, the animal paces (`mode: parched`) and the Memory panel
states the reason. A jet within 6 m or a hard landing within 2 m flushes the shore
and cancels a drink in progress rather than queueing one, and a drink also aborts
on the frame the water turns bad, so nobody finishes a drink at water that has
stopped being drinkable. Predators favour committed drinkers, which is why the
stalk-and-splash pattern appears at a good shore and not at a dry one.

Shore discovery uses sixteen rays from the herd's home patch, stepping 0.5 m out to
6.5 m and asking the same `water(x, z)` the body and camera trust — a shore an
animal can drink at is a shore you can wade at. The result is cached for one second.
Every decision is taken from a single frame-start snapshot, so herd behaviour is
deterministic and independent of array order.

## Executed evidence

- 68 source/behavior checks pass. Seven are new (`tools/wildlife-water.test.mjs`):
  thirst drives animals onto real water and quenches them; fouled, dry and vanished
  water stop drinking and read as pacing; a flush interrupts a drink; a drink
  aborts when the water turns bad mid-drink; predators switch to `ambush` against a
  drinker and close the distance; identical seeds give identical herds, including a
  reversed actor array; drink tracks are capped, validated, restored empty when
  absent and round-tripped through a version 6 save.
- `browser:wildlife` grew a real-system loop, using the existing debris-clearing
  action rather than injected animal state. Clearing the landslide wets the
  shallows, drinking starts, and the panel reads "Drink tracks in 2 places;
  nearest 2 m W." A drinker was verified standing where `region.water` says there
  is water (-5.66, -15.81) with 11 usable shores found. Re-blocking the spring
  dries the wetland: at wetness 0.101 the herd shows 7 pacing animals, nobody
  drinks, and eight one-second samples after the flip all report 33 sightings, so
  `dryGrowth` is 0 — a dry shore cannot farm more tracks.
- Low-predation and rich-habitat conditions were seeded through `ecosystem`, and
  the final screenshot vantage is an explicit fixture. Evidence:
  `docs/qa/wildlife-browser.json`.

## Inspected output and the fixes it forced

`artifacts/wildlife-drinking.png` and `artifacts/wildlife-parched.png`. Two
presentation defects surfaced while reading them and were repaired in this pass:

- The herd was painted the reed green and vanished into the marsh, so prey are now
  warm umber (`0x8b6a45`) against pale bank and reeds, predators charcoal
  (`0x2f2a33`) so danger reads first, and the basin frogs keep the reed tone under
  their own material.
- The drink line sat below two other paragraphs in Places remembered; it now sits
  directly under the place name, because it is the line that tells you where to
  look.

A third artefact was a near-black frame: the fixture had parked the viewer inside
the wetland bowl at water level. That was a vantage problem, not a renderer problem,
and was fixed by standing the camera on the rim.

## Still primitive

Animal bodies are spheres and share a silhouette with the scattered rocks, so they
now read by colour rather than shape. Drinking is a head dip, not locomotion or
contact animation. Thirst is session state and is deliberately not saved, and drink
tracks record only what was seen while playing — offline growth never invents
sightings. The herd stays on a 7 m leash around the reed shallows, so this is one
watering place, not a migration or a pathfinding system.

## Measured cost

After the change: 22 geometries, 6 textures, 39 draw calls and 31,236 triangles in
the ordinary run, all identical to before it. (Superseded by the named-reaches pass
in `docs/qa/REACHES.md`: 23 geometries, 40 calls and 122 line primitives, with the
journey bound raised to 24 to allow a chunk to overlap its own rebuild.) `npm run perf` medians on ANGLE
SwiftShader were 66.7 ms (high) and 33.4 ms (low) at 960x640. The adaptive A/B
shrank the buffer and left layout and triangle counts identical, but its median
gain in this sample was -0.1 ms where an earlier sample measured -16.6 ms, so the
frame-time benefit is noise-dominated here and is not claimed; only the structural
assertions replicate. No hardware or mobile measurement exists, and the 60 fps
desktop and 30 fps mobile-class targets remain undemonstrated.
