// The aim authority the player layer holds: a beam built from the orientation
// authority's heading and pitch, aimed at whatever the world offers. The rules and
// the ray maths live in `src/beam.js`, so the simulation reads exactly this instead
// of a second implementation that can drift.
import { JET_RULES, aimFromYaw, aimHeading, beamHit, jetHit } from "../beam.js";

export { JET_RULES, beamHit, jetHit, aimFromYaw, aimHeading };
// The reach the indicator and the mechanics share, so a lit reticle can never promise
// a shot the rules will not honour.
export const JET_REACH = JET_RULES.range;

// The view centre, expressed from the body. `rig` is the orientation authority, so
// pitch is included: a target on the bank in front of you is aimable, and the sky is
// not. Note the sign: the rig's pitch is positive looking *down* (the boom rises),
// so the beam's elevation is its negation.
export function aimFromRig(rig, origin) {
  const pitch = Number.isFinite(rig.pitch) ? -rig.pitch : 0;
  return aimFromYaw(
    typeof rig.heading === "function" ? rig.heading() : rig.yaw,
    origin,
    pitch,
  );
}

// The nearest valid target in the beam: what the mechanics resolve, and the only
// thing the aim indicator is allowed to light up for.
export function aimTarget(aim, targets) {
  let best = null;
  for (const target of targets) {
    const hit = jetHit(aim, target);
    if (hit && (!best || hit.along < best.hit.along)) best = { target, hit };
  }
  return best;
}
