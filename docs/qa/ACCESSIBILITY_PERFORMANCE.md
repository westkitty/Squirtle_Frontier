# Accessibility and renderer-adaptation pass — 2026-09-30

Approval gates remain waived for progression; nothing here is a human-assistive-technology or hardware-performance sign-off.

## Implemented

- Adaptive resolution (`src/adaptive-quality.js`): 60-frame windows of the existing raw frame timing; median over 26 ms lowers the render scale by 0.15, median under 13 ms with p95 under 32.5 ms raises it by 0.1, clamped to 0.55–1.0, one cooldown window between changes, outliers (non-finite, ≤0, >500 ms) discarded. It multiplies the preset pixel ceiling only: CSS size, simulation, body, camera and world rules are untouched. A settings checkbox (persisted) pins full detail; disabling restores scale 1 immediately.
- Draw-call trimming: instance batches (reeds, animals, prey/predator parts, rain, fire, channel) are hidden when their count is zero instead of issuing empty draws. Ordinary calls went 40 → 39 with identical geometry ownership (22 geometries, six textures).
- Motion preference is now tri-state (follow the system / reduce / full) and applies live. Previously `Settings.applyDocument()` only ran at boot, so the in-game choice had no effect until reload — a real defect found by the new audit. The OS media-query change listener re-applies only while the value is “follow the system”.
- Preference clamping: explicit out-of-range numbers clamp (a deliberate volume 0 no longer resets to 0.7); only missing/non-numeric values fall back. Corrupt `reducedMotion` / unknown `quality` fall back instead of disabling adaptation or persisting garbage.
- Keyboard focus: the world canvas is focusable and gets an explicit 3 px `#ecd19c` ring (`:focus-visible`), matching UI controls; opening a panel focuses the panel (it announces its heading even when it has no controls) and closing hands focus back to the canvas; Escape closes all panels, resets `aria-expanded` and announces closure in the `role="status"` output. Panels now carry `aria-labelledby`, are `tabindex="-1"`, and opening one refreshes its contents on the same frame instead of waiting for the HUD cadence (previously the survey text could appear blank for up to three frames, which the wildlife journey caught as an empty paragraph).
- Layout: the survey SVG is capped at 190 px with a 1:1 ratio so added paragraphs stay inside the scroll area; the panel gets a visible scrollbar thumb. Mobile top offsets keep the nav below the title and the stick clear of the footer.
- Input hardening: keyboard events whose target is not an element no longer throw; `setPointerCapture` failure (already-released or synthetic pointer) no longer aborts pointer tracking.

## Executed evidence

- 58 source/behavior checks pass, including three new settings/adaptive tests (`tools/settings.test.mjs`, `tools/adaptive.test.mjs`).
- `npm run build` passes with the existing large-chunk warning (628.7 kB / 169.4 kB gzip; the app is a single bundle and no split has been justified yet).
- `browser:a11y`: accessible-name and `aria-hidden` sweep; WCAG contrast (≥4.5) over composited translucent backgrounds, lowest measured 11.22 desktop / 5.15 touch; 10-stop Tab walk where every in-page stop is `:focus-visible` with ≥2 px outline; per-panel keyboard open/announce/Escape cycle with `aria-expanded` verification; reduced-motion honoured from the emulated OS, overridable in game, and reversible; adaptive toggle persistence plus pixel-ratio/buffer assertions; touch target sizes; real CDP finger drag on the stick (deflection then clean release, 0.867 m travelled); keyboard-only movement 0.574 m; layout clearance assertions. Evidence `docs/qa/accessibility-browser.json`.
- `browser:dist`: `vite build` output served by a plain static HTTP server (no dev module graph asserted from the request log), boots, moves under real key input, saves, reloads to the same position and channel stage, keeps exactly one cached Squirtle reference, and reaches zero geometries/textures after `dispose()`. Evidence `docs/qa/dist-browser.json`, screenshot `artifacts/dist-built.png`.
- `npm run perf` adds a controlled A/B in the same software-rendered page: pinned full detail 116.6 ms median / 216.7 ms p95 at 960x640 versus adaptive 100.0 ms median / 216.7 ms p95 at an 816x544 buffer with unchanged 960x640 CSS. Median improved 16.6 ms; p95 did not improve in this sample. Triangle count and geometry ownership are unchanged, which is expected for a pixel-budget control. Ordinary scenarios this run: high 100.0 ms median, low 50.1 ms median; both far from the 60/30 fps goals because this is ANGLE SwiftShader, not a GPU or a phone.
- Full ladder rerun: movement, watershed, habitat, world, recovery, channel, wildlife, a11y and dist journeys all pass after the panel/CSS changes.

## Inspected output

`artifacts/a11y-touch.png`: title clear of the nav, labelled 104 px stick and 48–64 px action buttons, readable hint and footer. `artifacts/settlement-memory.png`: all three panel paragraphs visible; caretaker now reads as one figure with a lifted arm beside the trough instead of detached brown limbs. Remaining visual issues, unresolved and not hidden: the caretaker is still a crude solid, the house is an untextured box whose wall crowds the camera at close range, and world text over the rendered scene is measured against DOM backgrounds rather than actual pixels.

## Not claimed

No screen-reader (NVDA/VoiceOver/TalkBack) session, no real-device touch usability test, no desktop-GPU or mobile frame-rate measurement, no WCAG certification, and no sign-off that motion/contrast settings are sufficient for photosensitivity. Production completion is still not claimed.

## Perf evidence after the wildlife-water pass (2026-09-30)

`docs/performance/phase1-measured.json` is rewritten by `npm run perf`. Latest run:
high 66.7 ms median (183.3 p95) and low
33.4 ms (83.3 p95) on ANGLE SwiftShader at 960x640;
39 draw calls, 22 geometries,
6 textures, 31,236 triangles;
teardown 0 geometries and
0 textures with
9 chunk loads and
9 unloads.

Adaptive A/B this run: median 83.3 to
83.2 ms (-0.1 ms)
and p95 166.6 to 150.0 ms
at a 816x544 buffer with unchanged
960x640 CSS. An earlier sample measured -16.6 ms median for the
same control and this one did not replicate it, so the medians are treated as
noise-dominated under shared-CPU software rendering while the structural assertions
(buffer shrinks, layout and triangle counts unchanged, scale reverts on opt-out) are
the reproducible result. The 60 fps desktop and 30 fps mobile-class targets remain
undemonstrated anywhere, and no hardware or mobile measurement exists.

Current ordinary-run figures after the named-reaches pass: 23 geometries, six
textures, 40 draw calls, 31,236 triangles and 122 line primitives on the frontier,
19 geometries in the Lab, zero on teardown; the journeys' frontier bound is 24.
`docs/qa/REACHES.md` records why one shared line mesh and a slightly higher bound
were the cheaper trade than either per-reach geometry or dropping the legibility.

## Chunk detail budget (2026-10-01)

A carved groove is 0.44 m wide but the chunk that holds it is 24 m across, and
`ChunkManager.rebuildList` used to answer that by forcing 128 segments on _every_
streamed chunk whose bounds overlapped the channel. With `Streaming.radius = 1` that
means the chunk you stand on and up to eight neighbours, i.e. one 32,768-triangle
mesh per overlap where 32 segments is the ordinary neighbourhood density.

The rule is now distance-shaped: 128 for the chunk the body is on, 64 for the ring
around it (still double the ordinary 32, so an adjacent chunk never looks cheaper than
the rest of the neighbourhood), and the plain ring LOD beyond. Physics is unaffected:
contact height is analytic `sampleHeight`, and the standing chunk keeps full density so
the ground under the shell matches it vertex for vertex.

Measured in the same shared-CPU ANGLE SwiftShader page, `npm run perf` scenarios,
one run per rule, only `src/terrain.js` differing:

| view                            | triangles before | triangles after | median ms before | after |
| ------------------------------- | ---------------- | --------------- | ---------------- | ----- |
| standing in the groove (ring 0) | 55,241           | 55,241          | 83.2             | 83.3  |
| viewed from the next chunk over | 56,445           | 31,869          | 66.6             | 50.0  |

The saving is the deterministic part (-24,576 triangles, -43.5%); the one-frame median
shift is not, since these medians quantise to 16.6 ms multiples and the control A/B of
adaptive resolution in this environment has already shown ±16 ms of run-to-run noise.
No regression on the ordinary run: high 66.7 ms median (166.7 p95), low 49.9 (83.4),
23 geometries / 40 calls / 31,236 triangles on the bank, teardown zero.

Whether the cheaper ring is _visible_ was answered with a control rather than an
opinion: `tools/png-diff.mjs` decodes two 900x560 screenshots and reports mean channel
delta, worst pixel and the share of pixels moved by more than 24/765. Both shots come
from the same forced-stage-4 pose, so anything that differs is animation. The pair
where nothing changed (standing in the groove) differs by 0.0011 mean and 0.003% of
pixels; the far view where the chunk dropped to 64 segments differs by 0.0005 and
0.001%; the third pose tried, standing 5 cm from the chunk border and looking down the
groove, differs by 0.0227 and 0.001%. So at viewing distance the removed tessellation
is not visible at all, and up close against a border it is a sub-pixel shape shift on
one in 100,000 pixels, recorded here rather than smoothed over.

Still unknown after this: any real GPU or mobile number, and whether 64 is enough
detail for a _wider_ cut if the channel is ever carved to more than one chunk.

## The basin level costs nothing to draw (2026-10-01)

`docs/qa/WATER_LEVEL.md` derives one height from the wetland node and lets the wade
predicate, the herd's shore, the painted shallows and the reach readouts all read it. No
mesh, geometry or draw call was added, and the triangle count is identical before and
after (`31,236` on the bank, `55,241` in the cut): 23 geometries, six textures, 40 calls,
122 line primitives, 66.7 ms median on high and 33.3 ms on low in this environment,
teardown zero. What did change is what is _seen_: the same-pose screenshot pair differs on
`tools/png-diff.mjs` by mean channel delta 1.49 with 4.4% of pixels moved, against the
0.0005 / 0.001% of the invisible LOD saving. Targets for real hardware and mobile remain
undemonstrated.
