// The one place that turns two authoritative simulation states into a render pose.
//
// Simulation is a 60 Hz fixed step; rendering is whatever the display manages.
// Showing the last simulation state directly makes motion look like a slideshow
// at 30 Hz and judders at any cadence that is not exactly 60. Interpolating by
// the loop's `alpha` recovers the smoothness without inventing a second physics
// authority: nothing here ever writes to the body.
//
// Only the *transform* is interpolated. Mode, grounded state and velocities are
// semantics — a body does not half-swim, and a renderer must not be able to make
// a collision decision by averaging one. So `renderPose` copies them straight
// through from the authoritative state.
import { FIXED_DT } from "../loop.js";

// Beyond this a gap is a discontinuity (teleport, place change, reposition) and
// must be shown as the current state, not slid across.
export const MAX_INTERPOLATE_DISTANCE = 4;
export const MAX_INTERPOLATE_YAW = 1.4;

const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

export function shortestAngle(from, to) {
  return wrap(to - from);
}

export function poseOf(body) {
  return { x: body.x, y: body.y, z: body.z, yaw: body.yaw, pitch: body.pitch };
}

// Called by the simulation at the top of every fixed step, before the body moves:
// `prev` is whatever the body was when the current state was reached, so the pair
// always straddles one authoritative interval.
export function recordPose(body) {
  const p = body.prevPose;
  if (p) {
    p.x = body.x;
    p.y = body.y;
    p.z = body.z;
    p.yaw = body.yaw;
    p.pitch = body.pitch;
  } else {
    body.prevPose = poseOf(body);
  }
}

// Snap both ends to the body's current state: used after a teleport, place change,
// reload, reset or any explicit reposition, where interpolating across the jump
// would drag the camera through the world.
export function resetPose(body) {
  body.prevPose = poseOf(body);
}

// Authoritative pose at the exact midpoint of the last interval — the state a
// renderer would show with no interpolation at all, kept for tests that need the
// discrete simulation truth.
export function currentPose(body) {
  return { ...body, ...poseOf(body) };
}

export function interpolatedPose(body, alpha = 1, dt = FIXED_DT) {
  const previous = body.prevPose;
  if (!previous) return currentPose(body);
  const dx = body.x - previous.x,
    dy = body.y - previous.y,
    dz = body.z - previous.z;
  // A gap the body cannot have travelled in one interval, or an unfinished
  // interval, is not motion to smooth: show the current state.
  if (
    Math.hypot(dx, dy, dz) > MAX_INTERPOLATE_DISTANCE ||
    Math.abs(shortestAngle(previous.yaw, body.yaw)) > MAX_INTERPOLATE_YAW ||
    Math.abs((body.pitch ?? 0) - (previous.pitch ?? 0)) > MAX_INTERPOLATE_YAW
  )
    return currentPose(body);
  const t = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
  return {
    ...body,
    x: previous.x + dx * t,
    y: previous.y + dy * t,
    z: previous.z + dz * t,
    yaw: previous.yaw + shortestAngle(previous.yaw, body.yaw) * t,
    pitch:
      (previous.pitch ?? 0) + ((body.pitch ?? 0) - (previous.pitch ?? 0)) * t,
    // Presentation telemetry only: how far into the interval this pose sits.
    poseAlpha: t,
    poseInterval: dt,
  };
}
