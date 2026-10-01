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
