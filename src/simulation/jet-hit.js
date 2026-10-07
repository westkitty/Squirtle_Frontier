export function createJetHitEvent() {
  return {
    serial: 0,
    active: false,
    kind: "",
    x: 0,
    y: 0,
    z: 0,
    intensity: 0,
    index: -1,
  };
}

export function resetJetHitEvent(event) {
  if (event) event.active = false;
  return event;
}

export function emitJetHit(
  event,
  kind,
  x,
  y,
  z,
  intensity = 1,
  index = -1,
) {
  if (!event) return null;
  const nextIntensity = Math.max(
    0,
    Math.min(1, Number.isFinite(Number(intensity)) ? Number(intensity) : 0),
  );
  if (!event.active) {
    event.serial++;
    event.active = true;
    event.kind = kind;
    event.x = Number.isFinite(x) ? x : 0;
    event.y = Number.isFinite(y) ? y : 0;
    event.z = Number.isFinite(z) ? z : 0;
    event.intensity = nextIntensity;
    event.index = Number.isInteger(index) ? index : -1;
  } else if (nextIntensity > event.intensity) {
    event.kind = kind;
    event.x = Number.isFinite(x) ? x : event.x;
    event.y = Number.isFinite(y) ? y : event.y;
    event.z = Number.isFinite(z) ? z : event.z;
    event.intensity = nextIntensity;
    event.index = Number.isInteger(index) ? index : event.index;
  }
  return event;
}
