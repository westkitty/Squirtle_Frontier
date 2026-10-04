// Contextual environmental attention for Squirtle. Pure spatial target resolution.
// Evaluates proximity, visual field cone, and behavioral salience.
import { heightAt } from "../worldgen.js";
import { fireSite } from "../simulation/frontier-systems.js";

export const ATTENTION_RADIUS = 12;
export const ATTENTION_FOV = 1.2; // ~69 degrees half-angle (138 deg total forward cone)
export const OMNI_PROXIMITY = 2.4; // Very close objects are noticed even from behind

export function resolveAttentionTarget({
  body,
  place = "frontier",
  state = null,
  wildlife = null,
  settlement = null,
  previous = null,
}) {
  if (!body) return null;

  const candidates = [];

  const addCandidate = ({ id, type, x, z, y = null, priority, radius = ATTENTION_RADIUS }) => {
    const dx = x - body.x,
      dz = z - body.z,
      distH = Math.hypot(dx, dz);
    if (distH > radius) return;

    // Check if within visual forward arc or very close proximity
    const targetYaw = Math.atan2(dx, dz);
    const yawDiff = Math.abs(
      Math.atan2(Math.sin(targetYaw - body.yaw), Math.cos(targetYaw - body.yaw)),
    );
    if (distH > OMNI_PROXIMITY && yawDiff > ATTENTION_FOV) return;

    const targetY = y !== null ? y : heightAt(x, z);
    candidates.push({
      id,
      type,
      x,
      y: targetY,
      z,
      priority,
      dist: distH,
      yawDiff,
    });
  };

  if (place === "frontier") {
    // 1. Living Wildlife Agents (Priority 10)
    if (wildlife?.actors) {
      for (const actor of wildlife.actors) {
        if (!actor) continue;
        const priority =
          actor.kind === "predator"
            ? actor.mode === "ambush"
              ? 13
              : actor.mode === "stalk"
                ? 12
                : 10
            : actor.mode === "flee" || actor.mode === "evade"
              ? 11
              : actor.mode === "drink"
                ? 9
                : 10;
        addCandidate({
          id: `wildlife-${actor.kind}-${actor.slot}`,
          type: "wildlife",
          x: actor.x,
          z: actor.z,
          y: heightAt(actor.x, actor.z) + (actor.kind === "prey" ? 0.15 : 0.35),
          priority,
          radius: 9,
        });
      }
    }

    // 2. Active Fire Hazards (Priority 8)
    if (state?.frontier?.heat) {
      for (let i = 0; i < 16; i++) {
        const heat = state.frontier.heat[i];
        if (heat > 0.05) {
          const p = fireSite(i);
          addCandidate({
            id: `fire-${i}`,
            type: "fire",
            x: p.x,
            z: p.z,
            y: heightAt(p.x, p.z) + heat * 0.8,
            priority: 8,
            radius: 11,
          });
        }
      }
    }

    // 3. Settlement Caretaker & Water Bowl (Priority 6)
    if (settlement) {
      const sh = heightAt(-15, -12);
      // Caretaker position based on settlement response mode
      const isWithdrawn = settlement.response === "withdraw";
      if (!isWithdrawn) {
        const cx = settlement.response === "check-water" ? -12.6 : -12.1;
        const cz = settlement.response === "check-water" ? -8.6 : -9.4;
        addCandidate({
          id: "settlement-caretaker",
          type: "caretaker",
          x: cx,
          z: cz,
          y: sh + 0.95,
          priority: 6,
          radius: 14,
        });
      }

      // Filled water bowl
      if (settlement.bowl > 0.05) {
        addCandidate({
          id: "settlement-bowl",
          type: "bowl",
          x: -12.6,
          z: -8.9,
          y: sh + 0.2,
          priority: 7, // Thirst/fresh water draws attention
          radius: 5,
        });
      }
    }

    // 4. Key Spatial Landmarks (Priority 4)
    // Entrance to Listening Basin
    addCandidate({
      id: "lab-entrance",
      type: "landmark",
      x: -11,
      z: 5,
      y: heightAt(-11, 5) + 0.5,
      priority: 4,
      radius: 7,
    });

    // Landslide debris
    addCandidate({
      id: "landslide-debris",
      type: "landmark",
      x: -6,
      z: 12,
      y: heightAt(-6, 12) + 0.4,
      priority: 4,
      radius: 8,
    });
  } else if (place === "lab") {
    // Marked visitor frog in Lab if present
    if (state?.memory?.notable) {
      const n = state.memory.notable;
      const desired = 4 - n.familiarity * 2;
      const angle = n.marking * 1.5;
      const fx = Math.sin(angle) * desired;
      const fz = Math.cos(angle) * desired;
      addCandidate({
        id: "lab-frog",
        type: "wildlife",
        x: fx,
        z: fz,
        y: 0.12,
        priority: 10,
        radius: 8,
      });
    }

    // Central listening basin water
    addCandidate({
      id: "lab-basin",
      type: "water",
      x: 0,
      z: 0,
      y: -0.2,
      priority: 5,
      radius: 6,
    });
  } else if (place === "record") {
    // Central historical strata column
    addCandidate({
      id: "record-column",
      type: "record",
      x: 0,
      z: 0,
      y: body.y,
      priority: 5,
      radius: 5,
    });
  }

  if (candidates.length === 0) return null;

  // Sort by priority descending, then distance ascending
  candidates.sort((a, b) => b.priority - a.priority || a.dist - b.dist);
  let best = candidates[0];
  if (previous?.id && previous.id !== best.id) {
    const held = candidates.find((candidate) => candidate.id === previous.id);
    if (held) {
      const score = (candidate) => candidate.priority * 10 - candidate.dist,
        margin = 1.5;
      if (score(held) >= score(best) - margin) best = held;
    }
  }

  return {
    id: best.id,
    type: best.type,
    x: best.x,
    y: best.y,
    z: best.z,
    priority: best.priority,
    distance: best.dist,
  };
}
