# Staged local channel terrain — 2026-09-30

The saved channel stage reconstructs a local height depression at depths 0 / .025 / .07 / .14 / .22 metres along the terrain-derived route. Collision and camera sample this pure field; chunk geometry samples the same source. No per-frame erosion or global height mutation. A connected sloping water strip replaces independent horizontal patches.

Stage changes invalidate only overlapping chunks. The active channel chunk uses 128 segments to resolve the narrow groove; normal terrain keeps its prior resolution. Disposed geometry is replaced through the existing bounded stream queue. The coarse mesh interpolation outside vertices is not identical to a continuous height sampler; this is documented rather than a claim of perfect mesh collision.

Executed: 47 checks pass, build passes (bundle warning); existing movement/browser/lifecycle journey passes. New `browser:channel` observes stage change through the regional tick (explicit setup), checks rendered vertex error <1e-5, saves/reloads, performs 12 Lab/frontier returns, and verifies zero geometries/textures at shutdown. See `channel-browser.json`.

Opened initial screenshot: disconnected turquoise patches. Bounded visual repair: increase affected chunk resolution and construct connected sloping water triangles. Opened replacement `artifacts/channel-stage.png`: continuous visible course, still stylized/provisional art.

Stage-4 software timing ~133 ms median / ~250 ms p95 at 960x640; sampled ~55k triangles, 22 geometries, six textures. This is not a hardware pass, and additional channel geometry is a budget tradeoff. General fresh-bank software sample stored separately in `phase1-measured.json`.

Full generated watershed topology, larger traversal network, polished wildlife/settlement systems, accessibility and hardware performance work remain. No production completion claimed.
