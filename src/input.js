// Normalized inspection-rig input, not a playable character controller.
export class Input {
  constructor() {
    this.keys = new Set(); this.abort = new AbortController();
    const options = { signal: this.abort.signal };
    addEventListener('keydown', e => { if (!e.target.closest('button,input,select')) this.keys.add(e.code); }, options);
    addEventListener('keyup', e => this.keys.delete(e.code), options);
    addEventListener('blur', () => this.keys.clear(), options);
  }
  movement() {
    let x = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    let z = Number(this.keys.has('KeyS')) - Number(this.keys.has('KeyW'));
    const length = Math.max(1, Math.hypot(x, z)); return { x: x / length, z: z / length };
  }
  dispose() { this.abort.abort(); this.keys.clear(); }
}
