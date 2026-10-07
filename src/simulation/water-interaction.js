import { BYPASS_SITE, fireSite } from "./frontier-systems.js";
import { heightAt } from "../worldgen.js";
import { DEBRIS_SITE } from "./regional-sites.js";
// Body-space interaction rules shared by gameplay and tests; no imported mesh names.
export { DEBRIS_SITE };

function hoseHits(body, p, y) {
  if (!body.hoseActive) return false;
  const ox = body.x,
    oy = body.y + 0.22,
    oz = body.z,
    dx = p.x - ox,
    dy = y - oy,
    dz = p.z - oz,
    distance = Math.hypot(dx, dy, dz);
  if (distance <= 0.01 || distance > 2.8) return false;
  const aimLength = Math.hypot(body.hoseAimX, body.hoseAimY, body.hoseAimZ),
    aimX =
      Number.isFinite(aimLength) && aimLength > 0.001
        ? body.hoseAimX / aimLength
        : Math.sin(body.yaw),
    aimY =
      Number.isFinite(aimLength) && aimLength > 0.001
        ? body.hoseAimY / aimLength
        : 0,
    aimZ =
      Number.isFinite(aimLength) && aimLength > 0.001
        ? body.hoseAimZ / aimLength
        : Math.cos(body.yaw);
  return (aimX * dx + aimY * dy + aimZ * dz) / distance > 0.65;
}

export function applyWaterJet(watershed, body, dt) {
  if (!hoseHits(body, DEBRIS_SITE, heightAt(DEBRIS_SITE.x, DEBRIS_SITE.z)))
    return false;
  return watershed.clearDebris("landslide", dt * 0.65);
}

export function applyWorldJet(frontier, body, dt) {
  if (!body.hoseActive) return;
  if (hoseHits(body, BYPASS_SITE, heightAt(BYPASS_SITE.x, BYPASS_SITE.z)))
    frontier.bypass = Math.min(1, frontier.bypass + dt * 0.4);
  for (let i = 0; i < 16; i++) {
    const p = fireSite(i);
    if (hoseHits(body, p, heightAt(p.x, p.z))) {
      frontier.heat[i] = Math.max(0, frontier.heat[i] - dt * 1.5);
      frontier.soaked[i] = Math.min(1, frontier.soaked[i] + dt);
      if (frontier.ash[i] > 0)
        frontier.ash[i] = Math.max(0, frontier.ash[i] - dt * 0.8);
    }
  }
}
