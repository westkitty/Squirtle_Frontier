# Phase 1 movement slice — technical evidence, not gate acceptance

Date: 2026-09-30. Phase 2 has **not** started.

## Implemented

- Direct Squirtle control through a body-state controller, separate from imported scene hierarchy.
- Walk/run acceleration and braking, grounded heightfield contact, bounded steps, rock and tree collision proxies.
- Distinct surface swimming, diving, ascent, local current influence and Water Jet surface launch/underwater boost.
- Shell impulse, momentum, slope acceleration, steering, friction, impact response and release recovery.
- Low follow camera, mouse/touch look, sampled boom collision, underwater transition, sensitivity/invert/reduced-motion settings.
- New procedural rig poses (not source animation clips), bounded 32-instance splash/jet pool, contact blob and one procedural audio graph.
- One small streamed movement region with instanced groves and a local training pond. Not a watershed, not ecology, not a Lab.
- Touch stick and labeled hold buttons. No rapid tapping required. Touch/game feel is not established by emulation.

## Commands actually run

- `npm run check`: 14 tests and all source syntax/authority checks pass.
- `npm run build`: passes; large JS bundle warning remains, ~594 kB / 158 kB gzip.
- `npm run assets`: GLB validator zero errors, one documented skinned-parent warning, 981,708 runtime bytes; manifest hash matches.
- `BROWSER_BUNDLED=1 npm run browser`: land run → shell slide → jet → physical water entry → swim → dive → boost → ascent → surface launch → camera drag → settings/save/reload; 12 chunk return cycles and 30 rendered asset acquire/release cycles; zero captured console/page errors. Touch CDP journey exercises stick movement and cancellation; portrait/landscape layouts captured.
- `BROWSER_BUNDLED=1 npm run perf`: high/low detail samples and awaited teardown. Zero chunk objects, geometries, textures and asset references after full cleanup. See `../performance/phase1-measured.json`.

`phase1-browser.json` records compact journey and lifecycle evidence. Large scratch screenshots/logs remain in ignored `artifacts/`.

## Rendered inspection

Opened actual front/back GLB images and bank, shell-slide, swim, underwater, 390×844 touch portrait and 844×390 landscape screenshots. Squirtle, surface water, underwater fog, shell retraction, and controls render. Touch targets do not cover the centered subject in captured layouts. Presentation remains sparse and provisional; no final visual acceptance or ten-minute enjoyment claim.

The first render exposed an array-vs-single-material attachment bug that hid the model; fixed by preserving the mesh's material shape. UV VEC3 export was converted to glTF-required VEC2. Imported bone names use Collada SIDs (`joint1`, etc.); semantic pose roles now map from the inspected hierarchy rather than assuming display names survived export. Surface ascent overshoot was clamped while leaving Water Jet launches free. Async shutdown now awaits cached texture disposal before renderer shutdown.

Probe corrections: renderer geometry uploads depend on visibility and one-time shared geometry use. Current absolute bound is 16 geometries (nine terrain + seven shared), with six textures during settled runtime; recorded home returns fluctuate within that bound and do not climb. Asset-cycle counts settle exactly. An early dive probe stopped at a shallow bottom; journey now swims to deeper water before testing deep dive. The touch wrapper has only positioned children and no box; visibility assertion targets the actual stick.

## Mandatory Phase 1 gates still open

1. **Ten-minute human movement enjoyment**: not evaluated. Automation establishes mechanics, not pleasure. Run, swim, dive, shell-slide, jet and camera must each be enjoyable before Phase 2.
2. **Hardware performance**: unavailable. SwiftShader is slow (latest median ~133 ms high, ~100 ms low at 960×640), far below the 60 fps desktop target. This is not a hardware pass and must not be represented as smooth performance. Actual desktop GPU and mobile-class measurements are required before performance acceptance.
3. **Human touch usability, animation quality and audio review**: unverified. Procedural sound ran in browser journeys, but was not listened to. Captured poses are not proof of compelling animation.
4. Full movement-state save/recovery, remapping, true terrain LOD for the creature-scale region and broader accessibility coverage remain future work. Current save explicitly stores position/time only.

Do not label the Phase 1 gate passed. The next external evidence is a human movement playtest in the preview on actual hardware, with concrete feel/camera feedback and measured frame timings. Do not build semantic-world complexity while that gate is open.
