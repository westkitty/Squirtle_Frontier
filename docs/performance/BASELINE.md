# Phase 0 baseline — incomplete, gate blocked

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
