import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  LEVEL_EPSILON,
  POND_MAX_RADIUS,
  POND_RINGS,
  POND_SPOKES,
  levelChanged,
  pondOutline,
  pondShoreRadius,
} from '../src/player/pond-surface.js';
import { MovementScenery } from '../src/player/movement-scenery.js';
import { waterAt } from '../src/player/movement-region.js';
import {
  WATER_BASE,
  WATER_DRY_DROP,
  WATER_FULL_RISE,
} from '../src/simulation/water-level.js';

// A synthetic predicate with an exactly known answer, so the measurement can be checked
// against arithmetic rather than against the terrain it happens to be pointed at.
const disc = (radius) => (x, z) => x * x + z * z <= radius * radius;
const MARCH_STEP = 0.5;

test('a level is only re-measured when it has actually moved', () => {
  // The whole range a basin can travel is a third of a metre, so these two answers are
  // the difference between a shoreline that answers a repair and one that answers noise.
  assert.equal(levelChanged(null, WATER_BASE), true, 'a first measurement always happens');
  assert.equal(levelChanged(WATER_BASE, WATER_BASE), false, 'the same level is not a move');
  assert.equal(
    levelChanged(WATER_BASE, WATER_BASE + LEVEL_EPSILON / 2),
    false,
    'floating-point noise must not rebuild the same outline',
  );
  assert.equal(levelChanged(WATER_BASE, WATER_BASE - WATER_DRY_DROP), true, 'a drought moves it');
  assert.equal(levelChanged(WATER_BASE, WATER_BASE + WATER_FULL_RISE), true, 'a repair moves it');
  assert.equal(levelChanged(WATER_BASE, Number.NaN), false, 'a broken level is not a move');
  assert.equal(levelChanged(Number.NaN, WATER_BASE), true, 'a broken previous level is re-measured');
});

test('shore is measured where the predicate stops, not where a sample lands', () => {
  for (const radius of [3, 7.25, 12, 20]) {
    for (let s = 0; s < 12; s++) {
      const found = pondShoreRadius(disc(radius), (s / 12) * Math.PI * 2, 32);
      // Eight bisections from a 0.5 m bracket close to within two centimetres, and the
      // answer is the last wet point, so it can never exceed the true shore.
      assert.ok(
        Math.abs(found - radius) < 0.02,
        `radius ${radius} measured ${found}`,
      );
      assert.ok(found <= radius, 'reported shore must be inside the water');
    }
  }
});

test('shore is directional: one outline, not one radius', () => {
  // An ellipse twice as long on Z as on X, which is the shape of the authored basin.
  const ellipse = (x, z) => (x / 8) ** 2 + (z / 20) ** 2 <= 1;
  const alongX = pondShoreRadius(ellipse, 0, 32);
  const alongZ = pondShoreRadius(ellipse, Math.PI / 2, 32);
  assert.ok(Math.abs(alongX - 8) < 0.02, `along X measured ${alongX}`);
  assert.ok(Math.abs(alongZ - 20) < 0.02, `along Z measured ${alongZ}`);
  // A single radius would have had to report one of these numbers in both directions.
  assert.ok(Math.abs(alongZ - alongX) > 10, 'the two axes must differ');
  assert.ok(
    Math.abs(pondShoreRadius(ellipse, -Math.PI / 2, 32) - 20) < 0.02,
    'the measurement is symmetric front and back',
  );
});

test('a ray that never leaves the water is clamped, never invented', () => {
  // The predicate cannot produce this, but if it ever did, the honest answer is the
  // basin's own bound rather than a shore nobody measured. The bound is deliberately not
  // a whole number of march steps, so a clamp that quietly returned the last sample it
  // happened to take reports a different value than the bound does.
  assert.equal(POND_MAX_RADIUS % MARCH_STEP, 0, 'fixture expects the base bound to be step-aligned');
  assert.equal(pondShoreRadius(() => true, 0, POND_MAX_RADIUS + 0.25), POND_MAX_RADIUS + 0.25);
  assert.equal(pondShoreRadius(() => true, 0, 30.25), 30.25);
  // And a ray that is dry from the centre outward has no shore at all.
  assert.equal(pondShoreRadius(() => false, 0, 32), 0);
});

test('the outline is resolved from the movement predicate by default', () => {
  // Every spoke must be water, and a point just past it must not be. This is the claim
  // that matters: the silhouette you see is the predicate the body swims by.
  const { spokes, radii } = pondOutline(WATER_BASE);
  assert.equal(spokes, POND_SPOKES);
  assert.equal(radii.length, POND_SPOKES);
  for (let s = 0; s < spokes; s++) {
    const a = (s / spokes) * Math.PI * 2,
      r = radii[s];
    assert.ok(r > 0, `spoke ${s} found no water`);
    assert.ok(waterAt(Math.cos(a) * r, Math.sin(a) * r, WATER_BASE), `spoke ${s} dry`);
  }
});

test('raising the basin level walks the visible shoreline outward', () => {
  const low = pondOutline(WATER_BASE - WATER_DRY_DROP),
    high = pondOutline(WATER_BASE + WATER_FULL_RISE);
  let grew = 0,
    shrank = 0;
  for (let s = 0; s < low.spokes; s++) {
    assert.ok(high.radii[s] >= low.radii[s] - 1e-6, `spoke ${s} retreated when flooded`);
    if (high.radii[s] > low.radii[s] + 1e-9) grew++;
    if (high.radii[s] < low.radii[s] - 1e-9) shrank++;
  }
  assert.ok(grew > low.spokes * 0.8, `only ${grew} spokes answered a full basin`);
  assert.equal(shrank, 0, 'a full basin cannot uncover ground');
  // The basin's long axis is where a repair is most visible, and the whole point is that
  // it is visible in metres rather than in a number on a panel.
  const axis = (o) => Math.max(...o.radii);
  assert.ok(
    axis(high) - axis(low) > 0.8,
    `shoreline moved only ${(axis(high) - axis(low)).toFixed(2)} m`,
  );
});

test('ring count is a tessellation choice and never moves the shore', () => {
  const a = pondOutline(WATER_BASE, { rings: 2 }),
    b = pondOutline(WATER_BASE, { rings: POND_RINGS });
  assert.deepEqual([...a.radii], [...b.radii]);
  assert.equal(a.rings, 2);
  assert.equal(b.rings, POND_RINGS);
});

test('the same level resolves the same outline every time', () => {
  const a = pondOutline(WATER_BASE),
    b = pondOutline(WATER_BASE);
  assert.deepEqual([...a.radii], [...b.radii]);
});

test('a custom probe overrides the movement predicate', () => {
  const { radii } = pondOutline(0, { isWet: disc(5), spokes: 8 });
  assert.equal(radii.length, 8);
  for (const r of radii) assert.ok(Math.abs(r - 5) < 0.02, `measured ${r}`);
});

test('every pond triangle faces upward, so DoubleSide lighting cannot flip between rings', () => {
  const scenery = new MovementScenery(new THREE.Scene(), {
    chunks: { onChunkBuild: null, onChunkRemove: null },
  });
  const geometry = scenery.water.geometry,
    positions = geometry.attributes.position.array,
    indices = geometry.index.array;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3,
      b = indices[i + 1] * 3,
      c = indices[i + 2] * 3,
      abx = positions[b] - positions[a],
      abz = positions[b + 2] - positions[a + 2],
      acx = positions[c] - positions[a],
      acz = positions[c + 2] - positions[a + 2],
      normalY = abz * acx - abx * acz;
    assert.ok(normalY > 0, `triangle ${i / 3} faces down (${normalY})`);
  }
  scenery.dispose();
});

test('the rendered basin surface is the measurement, and it is rebuilt when the level moves', () => {
  // The whole causal chain, on the real presentation object: a level change has to reach
  // the geometry the player actually looks at. A shoreline that is measured but never
  // handed to the mesh is the same visible defect as one that was never measured.
  const scenery = new MovementScenery(new THREE.Scene(), {
    chunks: { onChunkBuild: null, onChunkRemove: null },
  });
  const atRest = scenery.water.geometry;
  const shore = (g, s) => g.attributes.position.array[(1 + s) * 3 + 2];
  assert.equal(scenery.buildWater(WATER_BASE), false, 'the same level is not a rebuild');
  assert.equal(scenery.water.geometry, atRest, 'an unmoved basin must reuse its outline');
  const before = shore(atRest, 0);

  assert.equal(
    scenery.buildWater(WATER_BASE + WATER_FULL_RISE),
    true,
    'a full basin must re-measure its shoreline',
  );
  assert.notEqual(scenery.water.geometry, atRest, 'the mesh still holds the dry outline');
  assert.equal(scenery.waterLevel, WATER_BASE + WATER_FULL_RISE);
  assert.ok(
    Math.abs(shore(scenery.water.geometry, 0) - before) > 0.05,
    'the rebuilt outline did not actually move',
  );
  // The measured radius the spoke was drawn at is the predicate's own answer.
  const { radii } = pondOutline(WATER_BASE + WATER_FULL_RISE);
  assert.ok(Math.abs(shore(scenery.water.geometry, 0) - radii[0]) < 1e-6);
  scenery.dispose();
});
