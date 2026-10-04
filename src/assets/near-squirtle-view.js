import * as THREE from "three";
import { MAX_NEAR_CONSPECIFICS } from "../simulation/near-squirtles.js";

const TINT = Object.freeze({
  freshwater: { h: -0.01, s: 0.04, l: 0.055 },
  marsh: { h: 0.035, s: -0.03, l: -0.025 },
  urban: { h: 0.0, s: -0.09, l: -0.015 },
  saltwater: { h: -0.035, s: 0.04, l: -0.02 },
  deepwater: { h: 0.02, s: -0.04, l: -0.07 },
});

function ownMaterials(handle) {
  const owned = [];
  handle.root.traverse((object) => {
    if (!object.isMesh || !object.material) return;
    const source = Array.isArray(object.material) ? object.material : [object.material];
    const clones = source.map((material) => {
      const clone = material.clone();
      owned.push({ material: clone, color: clone.color?.clone?.() ?? null });
      return clone;
    });
    object.material = Array.isArray(object.material) ? clones : clones[0];
  });
  return owned;
}

export class NearSquirtleView {
  constructor(parent, assets) {
    this.parent = parent;
    this.assets = assets;
    this.entries = [];
    this.pending = 0;
    this.pendingTasks = new Set();
    this.disposed = false;
    this.active = 0;
    this.loadError = null;
    this.tmpTint = new THREE.Color();
  }

  async acquireOne() {
    this.pending++;
    try {
      const handle = await this.assets.acquire("playable.squirtle");
      if (this.disposed) {
        handle.root.traverse((object) => object.skeleton?.dispose?.());
        this.assets.release(handle);
        return;
      }
      const materials = ownMaterials(handle),
        group = new THREE.Group();
      group.visible = false;
      group.add(handle.root);
      this.parent.add(group);
      this.entries.push({ handle, materials, group, actorId: null });
    } catch (error) {
      this.loadError = error?.message || String(error);
    } finally {
      this.pending--;
    }
  }

  ensure(count) {
    const wanted = Math.min(MAX_NEAR_CONSPECIFICS, Math.max(0, count));
    while (this.entries.length > wanted) {
      const entry = this.entries.pop();
      this.releaseEntry(entry);
    }
    while (this.entries.length + this.pending < wanted) {
      const task = this.acquireOne();
      this.pendingTasks.add(task);
      task.finally(() => this.pendingTasks.delete(task));
    }
  }

  releaseEntry(entry) {
    if (!entry) return;
    entry.group.removeFromParent();
    for (const owned of entry.materials) owned.material.dispose?.();
    entry.handle.root.traverse((object) => object.skeleton?.dispose?.());
    this.assets.release(entry.handle);
  }

  applyVariant(entry, actor) {
    if (entry.actorId === actor.id) return;
    entry.actorId = actor.id;
    const tint = TINT[actor.ecotype] ?? TINT.urban,
      marking = ((actor.marking % 17) - 8) / 700;
    for (const owned of entry.materials) {
      if (!owned.color || !owned.material.color) continue;
      owned.material.color.copy(owned.color);
      owned.material.color.offsetHSL(tint.h + marking, tint.s, tint.l);
    }
  }

  update(near, env, elapsed = 0) {
    if (this.disposed) return;
    let active = 0;
    for (const actor of near?.actors ?? []) if (actor.active) active++;
    this.active = Math.min(active, MAX_NEAR_CONSPECIFICS);
    this.ensure(this.active);
    let slot = 0;
    for (const actor of near?.actors ?? []) {
      if (!actor.active || slot >= this.entries.length) continue;
      const entry = this.entries[slot++];
      this.applyVariant(entry, actor);
      const sample = env?.sample?.(actor.x, actor.z),
        ground = Number.isFinite(sample?.height) ? sample.height : 0,
        bob = actor.mode === "flee" || actor.mode === "travel" || actor.mode === "socialize"
          ? Math.abs(Math.sin(elapsed * 9 + actor.phase)) * 0.018
          : actor.mode === "forage"
            ? Math.abs(Math.sin(elapsed * 4 + actor.phase)) * 0.008
            : 0,
        hide = actor.mode === "hide" ? 0.78 : 1,
        rest = actor.mode === "rest" ? 0.95 : 1;
      entry.group.visible = true;
      entry.group.position.set(actor.x, ground + bob, actor.z);
      entry.group.rotation.y = actor.yaw;
      entry.group.scale.set(1, hide * rest, 1);
    }
    for (; slot < this.entries.length; slot++) this.entries[slot].group.visible = false;
  }

  releaseAll() {
    while (this.entries.length) this.releaseEntry(this.entries.pop());
    this.active = 0;
  }

  performanceStats() {
    return {
      active: this.active,
      pooled: this.entries.length,
      pending: this.pending,
      loadError: this.loadError,
    };
  }

  async dispose() {
    if (this.disposed) {
      await Promise.allSettled([...this.pendingTasks]);
      return;
    }
    this.disposed = true;
    this.releaseAll();
    await Promise.allSettled([...this.pendingTasks]);
    this.releaseAll();
  }
}
