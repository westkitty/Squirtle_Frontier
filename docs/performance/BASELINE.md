# Phase 0 baseline — software-browser foundation gate passed

Date: 2026-09-30. No Squirtle asset or world-feature complexity has been added to the renderer.

## Measured without a browser

- `npm run check`: all source syntax / focused authority checks and 7 behavioral tests pass.
- Node integration test: 100 chunk crossings, nine active chunks after each queue settles; every removed chunk emits geometry disposal; teardown leaves zero scene children and zero queued builds.
- This tests scene-object ownership, **not GPU memory release**.
- `npm run build`: passes. Main bundle about 571.09 kB, 149.21 kB gzip. Vite warns about a >500 kB chunk; retained as baseline evidence, not suppressed.
- `npm audit`: zero known vulnerabilities after non-force audit fix.

- Vite starts and serves the HTML and empty asset manifest via HTTP, including a synthetic `.e2b.app` Host header. This is an HTTP check, not a browser or deployment verification.

## Mandatory measurements still unknown

Boot/first interactive frame, renderer.info memory/render counts, sustained frame-time distribution, JS heap, actual shader compilation, GPU chunk cycling, imported asset cycling, screenshots, desktop hardware FPS and mobile hardware performance.

## External blocker and bounded attempt

`npx playwright install chromium` failed on CDN TLS connections (`ECONNRESET`) across its download hosts. One bounded direct-download fallback using curl also failed (`SSL_ERROR_SYSCALL`). No preinstalled browser executable was found in inspected system locations. Subsequent `npm run browser` confirms the required Chromium executable is absent; it fails before page creation. Updating vulnerable development dependencies changed the expected browser revision, but did not supply a browser.

`tools/browser-baseline.mjs` is ready to collect 120 initial frame samples and 24 actual renderer chunk transitions, assert settled resource counts and save a screenshot. It has **not passed**. Browser artifacts are ignored; no fabricated baseline numbers are stored here.

## Initial budgets (targets, not achieved measurements)

- Phase 0: at most nine active chunks; at most two chunk builds per render call.
- No active actors, particles or shadow maps in this baseline.
- Retained frame samples bounded at 600; fixed-step catch-up bounded at 100 ms.
- Desktop target: sustained 60 fps; later mobile-class target: sustained 30 fps on actual hardware.
- Zero growing geometry/texture counts over settled repeated traversal is mandatory.

Phase 1 is blocked until actual browser/render/performance evidence is captured and inspected. The node lifecycle test must not be used to bypass this gate.

## Browser capability restored (2026-09-30)

Pinned npm-distributed Chromium 140.0.0 and its bundled NSS/NSPR libraries bypass the unreachable Playwright CDN; `tools/browser-launch.mjs` extracts tools to temporary storage, not Git. Debian package repositories were also unreachable. Run `BROWSER_BUNDLED=1 npm run browser`.

Actual browser baseline now passes: 24 crossings and four identical-position return checkpoints; nine active owned chunks, stable uploaded geometry/texture counts at matched positions, zero console/page errors. The first assertion incorrectly compared different camera positions (five vs six uploaded geometries). The bounded probe repair compares identical return positions and bounds other positions by owned chunks. No resource assertion was removed without replacement.

Measurements: `phase0-measured.json`. Headless SwiftShader timing is a software-browser baseline, not hardware performance acceptance. Screenshot `artifacts/phase0-terrain.png` was opened and inspected: terrain surface and semantic inspection HUD render; no avatar is expected in Phase 0. The ground is deliberately sparse and not final presentation.

Earlier blocker/unknown entries above are retained as historical evidence. Browser timing, renderer counts and screenshot inspection now have evidence. Real GPU/mobile performance, imported-asset cycling and full gameplay remain pending. Phase 1 may start; production performance gate remains open.
