import { BYPASS_SITE, fireSite } from "./frontier-systems.js";
import { heightAt } from "../worldgen.js";
import { DEBRIS_SITE } from "./regional-sites.js";
import { emitJetHit } from "./jet-hit.js";
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

export function applyWaterJet(watershed, body, dt, hitEvent = null) {
  const ground = heightAt(DEBRIS_SITE.x, DEBRIS_SITE.z);
  if (!hoseHits(body, DEBRIS_SITE, ground)) return false;
  const changed = watershed.clearDebris("landslide", dt * 0.65);
  emitJetHit(
    hitEvent,
    "debris",
    DEBRIS_SITE.x,
    Math.max(-0.15, ground) + 0.24,
    DEBRIS_SITE.z,
    changed ? 1 : 0.45,
  );
  return changed;
}

export function applyWorldJet(frontier, body, dt, hitEvent = null) {
  if (!body.hoseActive) return;
  const bypassY = heightAt(BYPASS_SITE.x, BYPASS_SITE.z);
  if (hoseHits(body, BYPASS_SITE, bypassY)) {
    frontier.bypass = Math.min(1, frontier.bypass + dt * 0.4);
    emitJetHit(
      hitEvent,
      "ground",
      BYPASS_SITE.x,
      bypassY + 0.08,
      BYPASS_SITE.z,
      0.55,
    );
  }
  for (let i = 0; i < 16; i++) {
    const p = fireSite(i),
      ground = heightAt(p.x, p.z);
    if (hoseHits(body, p, ground)) {
      const heatBefore = frontier.heat[i],
        ashBefore = frontier.ash[i];
      frontier.heat[i] = Math.max(0, heatBefore - dt * 1.5);
      frontier.soaked[i] = Math.min(1, frontier.soaked[i] + dt);
      if (ashBefore > 0)
        frontier.ash[i] = Math.max(0, ashBefore - dt * 0.8);
      emitJetHit(
        hitEvent,
        heatBefore > 0.03 ? "fire" : ashBefore > 0.03 ? "ash" : "ground",
        p.x,
        ground + 0.1,
        p.z,
        Math.max(0.45, heatBefore, ashBefore),
        i,
      );
    }
  }
}
