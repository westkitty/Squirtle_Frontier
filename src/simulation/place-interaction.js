import { SETTLEMENT_BOWL } from "./settlement.js";

// Spatial actions are semantic rules; presentation only labels the eligible action.
export function placeAction(place, body, context = null) {
  if (place === "record") return body.y > -1 ? "record-exit" : null;
  if (place === "lab") {
    if (Math.hypot(body.x, body.z) < 1.5 && body.y < -0.9) return "record";
    if (Math.hypot(body.x, body.z - 6) < 2) return "leave";
    if (Math.hypot(body.x + 4.4, body.z - 4) < 2.1 && body.grounded)
      return "rest";
    if (
      context?.ecosystem?.labFrogs >= 1 &&
      Math.hypot(body.x, body.z) < 3.2 &&
      body.y > -0.6
    )
      return "play-frogs";
  } else if (place === "frontier") {
    if (Math.hypot(body.x + 11, body.z - 5) < 2.5) return "enter";
    if (
      context?.settlement &&
      body.grounded &&
      context.settlement.bowl > 0.05 &&
      context.settlement.familiarity >= 0.25 &&
      Math.hypot(body.x - SETTLEMENT_BOWL.x, body.z - SETTLEMENT_BOWL.z) < 1.6
    )
      return "drink-bowl";
  }
  return null;
}
