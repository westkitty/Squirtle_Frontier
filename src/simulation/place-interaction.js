// Spatial actions are semantic rules; presentation only labels the eligible action.
export function placeAction(place, body) {
  if (place === "record") return body.y > -1 ? "record-exit" : null;
  if (place === "lab") {
    if (Math.hypot(body.x, body.z) < 1.5 && body.y < -0.9) return "record";
    if (Math.hypot(body.x, body.z - 6) < 2) return "leave";
    if (Math.hypot(body.x + 4.4, body.z - 4) < 2.1 && body.grounded)
      return "rest";
  } else if (Math.hypot(body.x + 11, body.z - 5) < 2.5) return "enter";
  return null;
}
