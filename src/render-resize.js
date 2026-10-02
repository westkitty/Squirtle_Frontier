// One resize pump for the renderer.
//
// Adaptive quality and window resizes both used to call `setPixelRatio` +
// `setSize` directly, as often as the event fired. Two things went wrong: a burst of
// window events reallocated the framebuffer many times a second, and `setSize`'s
// default third argument rewrites the canvas' CSS width/height, so the element was
// rescaled by layout on a change that was supposed to be pixels-only. Both read as a
// flash — the picture briefly jumping size or resolution — rather than as a quality
// change.
//
// So requests are *coalesced*: many requests, one reallocation, applied at most once
// per rendered frame, and skipped entirely when the numbers did not actually move.
// The canvas keeps its CSS size (`updateStyle: false`) and owns its buffer size only.
export function createResizePump({ renderer, measure }) {
  let pending = false,
    applied = 0,
    current = null;
  const keyOf = (size) =>
    `${Math.round(size.width)}x${Math.round(size.height)}@${(
      Math.round(size.pixelRatio * 1000) / 1000
    ).toFixed(3)}`;
  return {
    // Cheap to call, safe to call every event: it only sets a flag.
    request() {
      pending = true;
    },
    // Called once per rendered frame. True means the framebuffer changed just now.
    flush() {
      if (!pending) return false;
      pending = false;
      const size = measure();
      if (!Number.isFinite(size.width) || !Number.isFinite(size.height))
        return false;
      const key = keyOf(size);
      if (key === current) return false;
      current = key;
      renderer.setPixelRatio(size.pixelRatio);
      renderer.setSize(size.width, size.height, false);
      applied++;
      return true;
    },
    // After a reallocation the next frame is expensive for a reason that has nothing
    // to do with the load the sampler is meant to measure. Anything measured so far is
    // stale, so the pump can announce what it just did to whoever is watching.
    get applied() {
      return applied;
    },
    get pending() {
      return pending;
    },
    get size() {
      return current;
    },
  };
}
