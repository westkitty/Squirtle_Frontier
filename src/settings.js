// Player preferences. Kept apart from the world save so that erasing a world
// does not throw away how the player likes to play.
const KEY = "squirtle_frontier_settings_v1";

export const HINT_KEYS = Object.freeze([
  "swim",
  "sense",
  "record",
  "gamepad",
]);

const DEFAULTS = {
  adaptive: true, // shrink render pixels when frames run long
  muted: false,
  volume: 0.7, // master audio level, 0 – 1
  quality: "high", // high | medium | low
  reducedMotion: null, // null = follow the operating system
  sensitivity: 1, // look speed multiplier, 0.4 – 2
  invertY: false,
  hints: true,
  seenHints: {},
  lastTab: "map",
  mapView: null, // where the player last had the survey map
};

function systemReducedMotion() {
  try {
    return !!(
      globalThis.matchMedia &&
      matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch (e) {
    return false;
  }
}

export const Settings = {
  values: { ...DEFAULTS },

  load() {
    this.values = { ...DEFAULTS, seenHints: {} };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(this.values, JSON.parse(raw) || {});
    } catch (e) {
      /* corrupt or unavailable storage: fall back to defaults */
    }
    // clamp anything a hand-edited/corrupt store could have broken
    const v = this.values;
    v.seenHints = Object.fromEntries(
      HINT_KEYS.filter((key) => v.seenHints && v.seenHints[key] === true).map(
        (key) => [key, true],
      ),
    );
    if (!["high", "medium", "low"].includes(v.quality)) v.quality = "high";
    // An explicit value clamps into range; only a missing or non-numeric one
    // falls back, so a deliberate slider at 0 survives.
    const number = (value, fallback, min, max) => {
      const n = Number(value);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    };
    v.sensitivity = number(v.sensitivity, 1, 0.4, 2);
    v.volume = number(v.volume, 0.7, 0, 1);
    // Motion is tri-state: null follows the operating system.
    if (v.reducedMotion !== true && v.reducedMotion !== false)
      v.reducedMotion = null;
    v.muted = !!v.muted;
    v.adaptive = v.adaptive !== false;
    v.invertY = !!v.invertY;
    v.hints = v.hints !== false;
    if (
      v.mapView &&
      !(
        Number.isFinite(v.mapView.cx) &&
        Number.isFinite(v.mapView.cz) &&
        v.mapView.span > 0
      )
    )
      v.mapView = null;
    if (!["map", "bag", "journal", "world"].includes(v.lastTab))
      v.lastTab = "map";
    return this.values;
  },

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.values));
      return true;
    } catch (e) {
      return false;
    }
  },

  set(key, value) {
    this.values[key] = value;
    this.save();
    return value;
  },
  get(key) {
    return this.values[key];
  },

  // Effective motion preference: explicit choice wins, otherwise the OS setting.
  get motionReduced() {
    return this.values.reducedMotion === null
      ? systemReducedMotion()
      : !!this.values.reducedMotion;
  },

  // Applies the preferences that live outside the game object.
  applyDocument() {
    try {
      document.body.classList.toggle("reduced-motion", this.motionReduced);
    } catch (e) {
      /* no document (tests) */
    }
  },
};
