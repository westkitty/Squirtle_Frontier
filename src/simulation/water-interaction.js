import { BYPASS_SITE, fireSite } from "./frontier-systems.js";
import { heightAt } from "../worldgen.js";
import { DEBRIS_SITE } from "./regional-sites.js";
// Body-space interaction rules shared by gameplay and tests; no imported mesh names.
export { DEBRIS_SITE };
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
export function senseWater(watershed, body, touchingWater, frontier = null) {
  if (!touchingWater) return null;
  const debris = watershed.nodes.find((n) => n.id === "landslide");
  return {
    x: DEBRIS_SITE.x,
    z: DEBRIS_SITE.z,
    strength:
      debris.blockage /
      (1 + Math.hypot(body.x - DEBRIS_SITE.x, body.z - DEBRIS_SITE.z) * 0.08),
    message:
      frontier?.ash.some((v) => v > 0.05) && frontier.weather.rain > 0
        ? "Ash washes in from the eastern bank. Rain carries it toward the wetland."
        : frontier?.diversion > 0.1
          ? "Water takes the opened side route. Less reaches the reed shallows."
          : debris.blockage > 0.1
            ? "Disturbed sediment upstream. Follow the amber ripple."
            : "The current runs clear. Water is reaching the wetland.",
  };
}

export function applyWorldJet(frontier, body, dt) {
  if (body.jetTime <= 0) return;
  const hits = (p, y) => {
    const dx = p.x - body.x,
      dz = p.z - body.z,
      d = Math.hypot(dx, dz);
    return (
      d > 0.01 &&
      d < 2.8 &&
      Math.abs(body.y - y) < 2 &&
      (Math.sin(body.yaw) * dx + Math.cos(body.yaw) * dz) / d > 0.65
    );
  };
  if (hits(BYPASS_SITE, heightAt(BYPASS_SITE.x, BYPASS_SITE.z)))
    frontier.bypass = Math.min(1, frontier.bypass + dt * 0.4);
  for (let i = 0; i < 16; i++) {
    const p = fireSite(i);
    if (hits(p, heightAt(p.x, p.z))) {
      frontier.heat[i] = Math.max(0, frontier.heat[i] - dt * 1.5);
      frontier.soaked[i] = Math.min(1, frontier.soaked[i] + dt);
      if (frontier.ash[i] > 0)
        frontier.ash[i] = Math.max(0, frontier.ash[i] - dt * 0.8);
    }
  }
}
