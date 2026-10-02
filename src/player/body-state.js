import { resetPose } from "./render-pose.js";

// Authoritative simulation state. Presentation-only *values* (pitch, prevPose)
// live here because the fixed step is what produces them; presentation-only
// *effects* (recoil, FOV, shake) never do. `prevPose` exists so the renderer can
// interpolate between two authoritative states without a second simulation.
export function createBody(x = -10, z = 18, y = 1) {
  const body = {
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: Math.PI,
    pitch: 0,
    mode: "land",
    grounded: true,
    slideHeld: false,
    jetCooldown: 0,
    jetTime: 0,
    distance: 0,
    impact: 0,
    resting: false,
    prevPose: null,
  };
  resetPose(body);
  return body;
}
