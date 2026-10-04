import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { WatershedPresentation } from "../src/player/watershed-presentation.js";
import { SPRING_SITE } from "../src/simulation/reaches.js";
import { createBody } from "../src/player/body-state.js";

test("Current Sense animates bounded downstream motes only on locally active water", () => {
  const scene = new THREE.Group(),
    view = new WatershedPresentation(scene),
    body = createBody(SPRING_SITE.x, SPRING_SITE.z, 0),
    watershed = { nodes: [{}, { blockage: 0.3 }] },
    water = {
      "spring-gully": { flowing: true, fraction: 1 },
    },
    first = new THREE.Matrix4(),
    second = new THREE.Matrix4();

  view.update(watershed, body, true, 1, [], 0, water);
  assert.equal(view.flowMotes.visible, true);
  assert.equal(view.flowMotes.count, 10);
  assert.equal(
    view.flowMotes.geometry,
    view.geometry,
    "Current Sense motes reuse the existing watershed geometry",
  );
  view.flowMotes.getMatrixAt(0, first);

  view.update(watershed, body, true, 1.4, [], 0, water);
  view.flowMotes.getMatrixAt(0, second);
  assert.notDeepEqual(
    first.elements,
    second.elements,
    "motes must travel along the reach over time",
  );

  view.update(
    watershed,
    body,
    true,
    2,
    [],
    0,
    { "spring-gully": { flowing: false, fraction: 0 } },
  );
  assert.equal(view.flowMotes.count, 0, "dry reaches must not invent flow");

  view.update(watershed, body, false, 2.2, [], 0, water);
  assert.equal(view.flowMotes.count, 0, "flow motes belong to Current Sense only");
  view.dispose();
});


test("named-reach flow guidance follows held Sense without weakening touch-water ripple gating", () => {
  const scene = new THREE.Group(),
    view = new WatershedPresentation(scene),
    body = createBody(SPRING_SITE.x, SPRING_SITE.z, 0),
    watershed = { nodes: [{}, { blockage: 0.3 }] },
    water = { "spring-gully": { flowing: true, fraction: 1 } };

  view.update(watershed, body, false, 1, [], 0, water, true);
  assert.equal(
    view.flowMotes.count,
    10,
    "held Current Sense must guide along a named active reach even without a touch-water signal",
  );
  assert.equal(
    view.ripple.visible,
    false,
    "the debris ripple must remain gated by the original touch-water signal",
  );

  view.update(watershed, body, false, 1.2, [], 0, water, false);
  assert.equal(view.flowMotes.count, 0);
  view.dispose();
});
