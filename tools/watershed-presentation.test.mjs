import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { WatershedPresentation } from "../src/player/watershed-presentation.js";
import { WorldState } from "../src/worldstate.js";
import { DEBRIS_SITE } from "../src/simulation/water-interaction.js";

test("ordinary watershed presentation keeps the physical obstruction without diagnostic overlays", () => {
  const scene = new THREE.Group(),
    view = new WatershedPresentation(scene),
    state = new WorldState(),
    body = { x: DEBRIS_SITE.x, z: DEBRIS_SITE.z };

  view.update(state.watershed, body);
  assert.equal(view.debris.count, 9);
  assert.equal("ripple" in view, false);
  assert.equal("flowMotes" in view, false);
  assert.equal("reachLines" in view, false);

  state.watershed.clearDebris("landslide", 0.1);
  state.watershed.clearDebris("landslide", 0.1);
  view.update(state.watershed, body);
  assert.ok(view.debris.count > 0 && view.debris.count < 9);

  while (state.watershed.nodes[1].blockage > 0)
    state.watershed.clearDebris("landslide", 0.1);
  view.update(state.watershed, body);
  assert.equal(view.debris.count, 0);
  view.dispose();
  assert.equal(scene.children.length, 0);
});

test("obstruction presentation is local world geometry rather than an always-on watershed diagram", () => {
  const scene = new THREE.Group(),
    view = new WatershedPresentation(scene),
    state = new WorldState();

  view.update(state.watershed, { x: DEBRIS_SITE.x, z: DEBRIS_SITE.z });
  assert.equal(view.group.visible, true);
  view.update(state.watershed, { x: DEBRIS_SITE.x + 80, z: DEBRIS_SITE.z + 80 });
  assert.equal(view.group.visible, false);
  assert.equal(scene.children.length, 1);

  view.dispose();
  assert.equal(scene.children.length, 0);
});
