export function createBody(x = -10, z = 18, y = 1) {
  return {
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: Math.PI,
    mode: "land",
    grounded: true,
    slideHeld: false,
    jetCooldown: 0,
    jetTime: 0,
    distance: 0,
    impact: 0,
    resting: false,
  };
}
