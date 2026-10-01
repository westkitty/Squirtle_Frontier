// Public semantic presentation boundary. Gameplay owns its body state independently.
import * as THREE from "three";
export class PlayableCreature {
  constructor() {
    this.root = new THREE.Group();
    this.bounds = { height: 0.55, radius: 0.23 };
    this.contacts = { left: [-0.12, 0, 0.06], right: [0.12, 0, 0.06] };
  }
  present(_body, _dt, _attentionTarget = null) {
    throw new Error("Presentation adapter required");
  }
  jetOrigin(target = new THREE.Vector3()) {
    return this.root.localToWorld(target.set(0, 0.35, 0.25));
  }
  lookTarget(target = new THREE.Vector3()) {
    return this.root.localToWorld(target.set(0, 0.43, 0.12));
  }
  interactionTarget(target = new THREE.Vector3()) {
    return this.root.localToWorld(target.set(0, 0.2, 0.4));
  }
  dispose() {
    this.root.removeFromParent();
  }
}
