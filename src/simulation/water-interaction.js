import { BYPASS_SITE, fireSite } from "./frontier-systems.js";
import { heightAt } from "../worldgen.js";
import { JET_RULES, jetHit } from "../beam.js";
// Body-space interaction rules shared by gameplay and tests; no imported mesh names.
export const DEBRIS_SITE = Object.freeze({ x: -6, z: 12 });
// Every Jet interaction resolves against the one aim beam: the debris pile, the
// fire sites, the ash and the bypass groove all answer to the same vector the
// presentation draws and the tests construct, so "what did my jet hit?" has exactly
// one answer. A missing aim means no aim authority was supplied, which is a bug
// rather than a miss - so it resolves as no hit rather than falling back to a heading.
export const JET_RANGE = JET_RULES.range;
export function jetTargets(frontier = null) {
  const targets = [
    {
      id: "landslide",
      x: DEBRIS_SITE.x,
      z: DEBRIS_SITE.z,
      y: heightAt(DEBRIS_SITE.x, DEBRIS_SITE.z),
    },
    {
      id: "bypass",
      x: BYPASS_SITE.x,
      z: BYPASS_SITE.z,
      y: heightAt(BYPASS_SITE.x, BYPASS_SITE.z),
    },
  ];
  for (let i = 0; i < 16; i++) {
    const site = fireSite(i);
    targets.push({
      id: `fire${i}`,
      index: i,
      x: site.x,
      z: site.z,
      y: heightAt(site.x, site.z),
    });
  }
  return targets;
}
export function applyWaterJet(watershed, body, dt, aim) {
  if (body.jetTime <= 0 || !aim) return false;
  const debris = {
    x: DEBRIS_SITE.x,
    z: DEBRIS_SITE.z,
    y: heightAt(DEBRIS_SITE.x, DEBRIS_SITE.z),
  };
  if (!jetHit(aim, debris)) return false;
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

export function applyWorldJet(frontier, body, dt, aim) {
  if (body.jetTime <= 0 || !aim) return;
  // Same beam, same reach, same cone: the bypass and the fire sites are aimed at
  // exactly the way the debris pile is.
  const hits = (p) => jetHit(aim, p) !== null;
  const bypass = {
    x: BYPASS_SITE.x,
    z: BYPASS_SITE.z,
    y: heightAt(BYPASS_SITE.x, BYPASS_SITE.z),
  };
  if (hits(bypass)) frontier.bypass = Math.min(1, frontier.bypass + dt * 0.4);
  for (let i = 0; i < 16; i++) {
    const site = fireSite(i);
    const p = { x: site.x, z: site.z, y: heightAt(site.x, site.z) };
    if (hits(p)) {
      frontier.heat[i] = Math.max(0, frontier.heat[i] - dt * 1.5);
      frontier.soaked[i] = Math.min(1, frontier.soaked[i] + dt);
      if (frontier.ash[i] > 0)
        frontier.ash[i] = Math.max(0, frontier.ash[i] - dt * 0.8);
    }
  }
}
