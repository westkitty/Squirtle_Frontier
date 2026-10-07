export const JET_HIT_LIFETIME = 0.1;

export function createJetHit() {
  return {
    active: false,
    kind: "none",
    x: 0,
    y: 0,
    z: 0,
    intensity: 0,
    time: 0,
    serial: 0,
  };
}

export function stepJetHit(hit, dt) {
  if (!hit) return hit;
  hit.time = Math.max(0, hit.time - Math.max(0, Number(dt) || 0));
  hit.active = hit.time > 0;
  if (!hit.active) {
    hit.kind = "none";
    hit.intensity = 0;
  }
  return hit;
}

export function markJetHit(hit, kind, x, y, z, intensity = 1) {
  if (!hit) return false;
  const nextX = Number(x) || 0,
    nextY = Number(y) || 0,
    nextZ = Number(z) || 0,
    changed =
      !hit.active ||
      hit.kind !== kind ||
      Math.hypot(hit.x - nextX, hit.y - nextY, hit.z - nextZ) > 0.25;
  hit.active = true;
  hit.kind = kind || "ground";
  hit.x = nextX;
  hit.y = nextY;
  hit.z = nextZ;
  hit.intensity = Math.max(0, Math.min(1, Number(intensity) || 0));
  hit.time = JET_HIT_LIFETIME;
  if (changed) hit.serial = (hit.serial + 1) >>> 0;
  return true;
}
