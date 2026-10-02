// Locomotion Zero, stage 9: what the body's own numbers mean, in words and in figures.
//
// Two surfaces, deliberately separated. The status line is a live region, so it carries
// prose a player may want read aloud, and only when something is worth saying. Telemetry is
// a panel of figures that changes every frame, which is exactly why it cannot live in a live
// region -- it is where render scale, the chunk pump and the frame cost go once they stop
// competing with the player's own confirmations.
import { CHANNELS } from "../status-arbiter.js";

export const FEEDBACK = Object.freeze({
  // How long each cue stays up. A blocked step is a nudge, not a notification.
  hold: { slope: 2.2, solid: 2, rim: 3.2, jet: 1.6, band: 2.6 },
  // And how soon the same kind of cue may be said again, so a body grinding along a rock
  // is told once rather than sixty times a minute.
  repeat: 6,
});

const BLOCKED_LINES = {
  slope: "Too steep to climb from here.",
  solid: "Something solid is in the way.",
  rim: "The rim of the valley begins here.",
};

const AMBIENT_LINES = {
  land: (moving) => (moving ? "On little feet." : "On the bank, still."),
  wade: () => "Wading, and the water sets the pace.",
  swim: () => "At the surface.",
  dive: () => "Below the surface.",
  slide: () => "Under way in your shell.",
  air: () => "In the air.",
};

/**
 * Cues with a memory. Everything here is a reading of state the simulation already
 * computed, and every cue is edge-triggered: a *change* is news, a level is not. The clock
 * is the fixed step's, handed in by `tick`, so the cooldowns cannot drift with frame rate.
 */
export function createFeedback({
  hold = FEEDBACK.hold,
  repeat = FEEDBACK.repeat,
} = {}) {
  let clock = 0,
    wasCooling = false,
    wasBand = null,
    wasBlocked = null;
  const announced = new Map();
  const speakable = (kind, now) => {
    const prior = announced.get(kind);
    if (prior !== undefined && now - prior < repeat) return false;
    announced.set(kind, now);
    return true;
  };
  return {
    /** @returns {{text: string, channel: number, ttl: number} | null} */
    read(body) {
      const blocked = body.blocked ?? null;
      if (BLOCKED_LINES[blocked] && blocked !== wasBlocked) {
        wasBlocked = blocked;
        if (speakable(`blocked:${blocked}`, clock))
          return {
            text: BLOCKED_LINES[blocked],
            channel: CHANNELS.contextual,
            ttl: hold[blocked] ?? 2,
          };
      } else if (!blocked) wasBlocked = null;
      // The jet being available again is only news if it was actually missed.
      const cooling = (body.jetCooldown ?? 0) > 0;
      if (wasCooling && !cooling && speakable("jet", clock)) {
        wasCooling = false;
        return {
          text: "The jet is charged again.",
          channel: CHANNELS.contextual,
          ttl: hold.jet,
        };
      }
      wasCooling = cooling;
      // Changing depth band is the one aquatic thing the mode line cannot say: the mode
      // stays "dive" while the light overhead changes.
      const band =
        body.submersion >= 1.1
          ? "deep"
          : body.submersion >= 0
            ? "shallow"
            : null;
      if (band !== wasBand) {
        const previous = wasBand;
        wasBand = band;
        if (previous !== null && band !== null && speakable("band", clock))
          return {
            text:
              band === "deep"
                ? "Down here the current has you."
                : "The water shallows.",
            channel: CHANNELS.contextual,
            ttl: hold.band,
          };
      }
      return null;
    },
    /** The resting readout for the status line: prose, no figures. */
    ambient(body) {
      const speak = AMBIENT_LINES[body.mode] ?? AMBIENT_LINES.land;
      return speak(Math.hypot(body.vx, body.vz) > 0.2);
    },
    tick(dt) {
      if (Number.isFinite(dt) && dt > 0) clock += dt;
    },
    get seconds() {
      return clock;
    },
  };
}

/**
 * What the telemetry panel shows, formatted here so precision and wording are testable
 * rather than trapped in a DOM call. Snapshot values are read straight off the simulation;
 * nothing here measures anything.
 */
export function telemetryLines(snapshot) {
  const s = snapshot ?? {};
  const num = (v, digits = 1) => (Number.isFinite(v) ? v.toFixed(digits) : "—");
  const int = (v) => (Number.isFinite(v) ? String(Math.round(v)) : "—");
  const chunks = s.chunks ?? {};
  const charge = Number.isFinite(s.jet01) ? Math.round(s.jet01 * 100) : null;
  return [
    ["Mode", String(s.mode ?? "—")],
    ["Ground speed", `${num(s.speed)} m/s`],
    [
      "Submersion",
      Number.isFinite(s.submersion) && s.submersion >= 0
        ? `${num(s.submersion, 2)} m`
        : "dry",
    ],
    [
      "Jet charge",
      charge === null ? "—" : charge >= 100 ? "ready" : `${charge}%`,
    ],
    ["Blocked by", s.blocked ?? "nothing"],
    ["Seconds in contact", num(s.contactTime, 1)],
    [
      "Render scale",
      s.scale === undefined ? "—" : `${Math.round(s.scale * 100)}%`,
    ],
    ["Quality", s.quality ?? "—"],
    ["Frame median", `${num(s.medianMs, 1)} ms`],
    ["Frame p95", `${num(s.p95Ms, 1)} ms`],
    [
      "Chunks streaming",
      `${int(chunks.active)} active, ${int(chunks.held)} held`,
    ],
    ["Queued builds", int(chunks.queued)],
    ["Ground missing", int(chunks.holes)],
    ["Height samples this frame", int(s.frameSamples)],
    ["Draw calls", int(s.calls)],
    ["Triangles", int(s.triangles)],
  ];
}
