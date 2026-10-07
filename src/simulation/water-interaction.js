import { BYPASS_SITE, fireSite } from "./frontier-systems.js";
import { heightAt } from "../worldgen.js";
import { DEBRIS_SITE } from "./regional-sites.js";
import { markJetHit } from "../player/jet-hit.js";
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

export function applyWaterJet(watershed, body, dt, hit = null) {
  const y = heightAt(DEBRIS_SITE.x, DEBRIS_SITE.z);
  if (!hoseHits(body, DEBRIS_SITE, y)) return false;
  markJetHit(hit, "debris", DEBRIS_SITE.x, y + 0.2, DEBRIS_SITE.z, 0.9);
  return watershed.clearDebris("landslide", dt * 0.65);
}

export function applyWorldJet(frontier, body, dt, hit = null) {
  if (!body.hoseActive) return;
  const bypassY = heightAt(BYPASS_SITE.x, BYPASS_SITE.z);
  if (hoseHits(body, BYPASS_SITE, bypassY)) {
    frontier.bypass = Math.min(1, frontier.bypass + dt * 0.4);
    markJetHit(hit, "mud", BYPASS_SITE.x, bypassY + 0.08, BYPASS_SITE.z, 0.55);
  }
  for (let i = 0; i < 16; i++) {
    const p = fireSite(i),
      y = heightAt(p.x, p.z);
    if (hoseHits(body, p, y)) {
      const heatBefore = frontier.heat[i],
        ashBefore = frontier.ash[i];
      frontier.heat[i] = Math.max(0, frontier.heat[i] - dt * 1.5);
      frontier.soaked[i] = Math.min(1, frontier.soaked[i] + dt);
      if (frontier.ash[i] > 0)
        frontier.ash[i] = Math.max(0, frontier.ash[i] - dt * 0.8);
      const kind = heatBefore > 0.05 ? "fire" : ashBefore > 0.05 ? "ash" : "mud",
        intensity = Math.min(1, 0.45 + heatBefore * 0.4 + ashBefore * 0.25);
      markJetHit(hit, kind, p.x, y + 0.12, p.z, intensity);
    }
  }
}
