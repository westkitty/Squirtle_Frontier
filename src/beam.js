// The Water Jet's beam: pure geometry plus the one set of rules that decide what a
// burst can reach. Kept free of camera, rig and renderer knowledge so the simulation
// can read the same rule the presentation draws, with no dependency pointing at the
// player layer.
//
// Jet targeting used to follow `body.yaw` - the *locomotion* heading - which disagrees
// with what the player is pointing at the moment they are not travelling straight at
// the thing. Aiming a water cannon while standing in the shallows means turning the
// view, so the view has to be the authority.

export const JET_RULES = Object.freeze({
  range: 2.8, // metres the beam is worth
  radius: 0.55, // how far off the beam a target may sit and still be caught
  lift: 2, // how much height difference the stream still catches at creature scale
  minRange: 0.01, // a target the body is inside is not "aimed at"
  cooldown: 1.1,
  burst: 0.36,
  faceRate: 9, // how fast the body presents the aim while firing, and nothing else
});

function normalize(origin, x, y, z) {
  const length = Math.hypot(x, y, z) || 1;
  return {
    origin: { x: origin.x, y: origin.y ?? 0, z: origin.z },
    x: x / length,
    y: y / length,
    z: z / length,
  };
}

// The low-level constructor: a heading and an elevation, no camera involved. Used by
// tests that want to name the direction they mean, and by anything that only has a
// body facing. `pitch` is the look elevation, positive looking up.
export function aimFromYaw(yaw, origin, pitch = 0) {
  const cp = Math.cos(pitch);
  return normalize(
    origin,
    Math.sin(yaw) * cp,
    Math.sin(pitch),
    Math.cos(yaw) * cp,
  );
}

// Closest approach of the beam to a point. Returns how far along the beam that is
// and how far off it, or null when the point is out of reach or out of the cone.
// This is the strict version: a laser line through the view centre.
export function beamHit(aim, target, radius = JET_RULES.radius) {
  if (!aim || !target) return null;
  const dx = target.x - aim.origin.x,
    dy = (target.y ?? 0) - aim.origin.y,
    dz = target.z - aim.origin.z,
    along = dx * aim.x + dy * aim.y + dz * aim.z;
  if (!(along > JET_RULES.minRange) || along > JET_RULES.range) return null;
  const off = Math.hypot(
    dx - aim.x * along,
    dy - aim.y * along,
    dz - aim.z * along,
  );
  return off <= radius ? { along, off } : null;
}

// The rule the game actually runs on. A squirtle's jet is a wide, short cone at
// creature scale, not a sniper rail, and the targets are ground features - a debris
// pile, a scorched cell, a groove in a bank - whose height belongs to the terrain
// rather than to anything the player can also stand on. So: the beam's *direction*
// decides which way the stream is thrown, the reach is measured along it, and a
// bounded height difference is forgiven. Pitch still matters, because the reach and
// the direction come from the full 3D vector: pointing at the sky cannot hit the
// bank in front of you, and pointing at the bank from a deep dive cannot hit a
// ledge behind it.
export function jetHit(aim, target, rules = JET_RULES) {
  if (!aim || !target) return null;
  const dx = target.x - aim.origin.x,
    dy = (target.y ?? 0) - aim.origin.y,
    dz = target.z - aim.origin.z;
  if (Math.abs(dy) > rules.lift) return null;
  const length = Math.hypot(dx, dy, dz);
  if (!(length > rules.minRange) || length > rules.range) return null;
  // Cone in the beam's own direction, evaluated against the planar offset that a
  // ground target presents: this keeps a level shot along a bank working while a
  // perpendicular one does not.
  const along = dx * aim.x + dy * aim.y + dz * aim.z;
  if (along <= rules.minRange) return null;
  const off = Math.hypot(
    dx - aim.x * along,
    dy - aim.y * along,
    dz - aim.z * along,
  );
  const planar = Math.hypot(
    dx - aim.x * Math.hypot(dx, dz),
    dz - aim.z * Math.hypot(dx, dz),
  );
  const spread = Math.min(off, planar);
  return spread <= rules.radius ? { along, off: spread } : null;
}

// The heading the body should present while the jet is out: the aim, flattened.
// Presentation-facing only - it never becomes the movement direction, so aiming
// cannot steer the body's path.
export function aimHeading(aim) {
  return Math.atan2(aim.x, aim.z);
}
