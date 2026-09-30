// Body-space interaction rules shared by gameplay and tests; no imported mesh names.
export const DEBRIS_SITE = Object.freeze({ x: -6, z: 12 });
export function applyWaterJet(watershed, body, dt) {
  const dx = DEBRIS_SITE.x - body.x,
    dz = DEBRIS_SITE.z - body.z;
  const distance = Math.hypot(dx, dz);
  if (
    body.jetTime <= 0 ||
    body.y < -1 ||
    body.y > 2 ||
    distance > 2.8 ||
    distance < 0.01
  )
    return false;
  if ((Math.sin(body.yaw) * dx + Math.cos(body.yaw) * dz) / distance < 0.65)
    return false;
  return watershed.clearDebris("landslide", dt * 0.65);
}
export function senseWater(watershed, body, touchingWater) {
  if (!touchingWater) return null;
  const debris = watershed.nodes.find((n) => n.id === "landslide");
  return {
    x: DEBRIS_SITE.x,
    z: DEBRIS_SITE.z,
    strength:
      debris.blockage /
      (1 + Math.hypot(body.x - DEBRIS_SITE.x, body.z - DEBRIS_SITE.z) * 0.08),
    message:
      debris.blockage > 0.1
        ? "Disturbed sediment upstream. Follow the amber ripple."
        : "The current runs clear. Water is reaching the wetland.",
  };
}
