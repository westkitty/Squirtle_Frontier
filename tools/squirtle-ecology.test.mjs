import { test } from "node:test";
import assert from "node:assert/strict";
import { WorldState } from "../src/worldstate.js";
import { Settlement } from "../src/simulation/settlement.js";
import {
  ECOTYPES,
  HABITATS,
  ConspecificEcology,
} from "../src/simulation/squirtle-ecology.js";
import { NearConspecifics, MAX_NEAR_CONSPECIFICS } from "../src/simulation/near-squirtles.js";
import { save, load, advanceOffline, SAVE_KEY } from "../src/persistence.js";

const storage = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
};
const body = (x = -9, z = -12) => ({ x, z, vx: 0, vz: 0, jetTime: 0, mode: "land", yaw: 0 });
const env = {
  obstacles: [],
  sample: () => ({ height: 0 }),
  water: () => ({ currentX: 0, currentZ: 0 }),
  drinkQuality: { contamination: 0, sediment: 0, wetness: 1 },
};
const rich = (state) => {
  state.watershed.nodes[0].flow = 1;
  state.watershed.nodes[0].wetness = 1;
  state.watershed.nodes[1].restoration = 1;
  state.watershed.nodes[2].wetness = 0.9;
  state.watershed.nodes[2].contamination = 0;
  state.watershed.nodes[2].sediment = 0;
  state.ecosystem.reeds = 0.9;
  state.ecosystem.cistern = 0.9;
  state.settlement.waterReliability = 0.9;
  state.settlement.familiarity = 0.7;
  state.settlement.fear = 0;
  for (let i = 0; i < 420; i++) state.squirtleEcology.tick(state.watershed, state.ecosystem, state.settlement);
};

test("five ecotypes exist but Stillwater refuses false saltwater/deepwater habitat", () => {
  assert.deepEqual(Object.keys(ECOTYPES).sort(), ["deepwater", "freshwater", "marsh", "saltwater", "urban"]);
  assert.equal(HABITATS.some((h) => h.ecotype === "saltwater"), false);
  assert.equal(HABITATS.some((h) => h.ecotype === "deepwater"), false);
  assert.ok(ECOTYPES.saltwater.toughness > ECOTYPES.freshwater.toughness);
  assert.equal(ECOTYPES.deepwater.surfaceAverse, true);
  assert.ok(ECOTYPES.urban.humanTolerance > 0.5);
  assert.equal(ECOTYPES.marsh.concealmentBias, 1);
  const state = new WorldState();
  rich(state);
  assert.equal(state.squirtleEcology.suitability.saltwater, 0);
  assert.equal(state.squirtleEcology.suitability.deepwater, 0);
});

test("watershed quality, wetland loss, infrastructure and Shucker pressure change suitability", () => {
  const state = new WorldState();
  rich(state);
  const good = { ...state.squirtleEcology.suitability };
  state.watershed.nodes[2].wetness = 0.01;
  state.ecosystem.reeds = 0.01;
  state.ecosystem.cistern = 0.02;
  state.settlement.waterReliability = 0.02;
  state.settlement.fear = 0.8;
  for (let i = 0; i < 420; i++) state.squirtleEcology.tick(state.watershed, state.ecosystem, state.settlement);
  assert.ok(state.squirtleEcology.suitability.marsh < good.marsh * 0.3);
  assert.ok(state.squirtleEcology.suitability.urban < good.urban * 0.4);
  rich(state);
  const safe = state.squirtleEcology.suitability.marsh;
  state.squirtleEcology.induceShuckerPressure(0.9, 90);
  state.squirtleEcology.tick(state.watershed, state.ecosystem, state.settlement);
  assert.ok(state.squirtleEcology.suitability.marsh < safe * 0.5);
});

test("ordinary caretaker legality has non-hostile states and reporting raises pressure without spawning combat", () => {
  const s = new Settlement();
  assert.equal(s.legalResponse, "ignore");
  s.present = true;
  assert.equal(s.legalResponse, "watch");
  s.familiarity = 0.2;
  assert.equal(s.legalResponse, "tolerate");
  s.familiarity = 0.4;
  s.bowl = 0.5;
  assert.equal(s.legalResponse, "feed");
  s.familiarity = 0.8;
  s.fear = 0;
  assert.equal(s.legalResponse, "protect");
  s.fear = 0.9;
  assert.equal(s.legalResponse, "report");
  const eco = new ConspecificEcology();
  const before = eco.humanPressure;
  eco.report();
  assert.ok(eco.humanPressure > before);
  assert.equal("combatants" in eco, false);
});

test("near Squirtles project deterministically, cap at three and react by ecotype", () => {
  const state = new WorldState();
  rich(state);
  state.squirtleEcology.abundance.marsh = 1;
  state.squirtleEcology.abundance.urban = 1;
  state.squirtleEcology.abundance.freshwater = 1;
  state.squirtleEcology.bumpRevision();
  const a = new NearConspecifics(state.seed), b = new NearConspecifics(state.seed), player = body();
  for (let i = 0; i < 120; i++) {
    a.step(1 / 60, player, "frontier", state.squirtleEcology, state.memory, env);
    b.step(1 / 60, player, "frontier", state.squirtleEcology, state.memory, env);
  }
  assert.ok(a.activeCount <= 3);
  assert.deepEqual(a.actors, b.actors);
  const marsh = a.actors.find((actor) => actor.ecotype === "marsh"), urban = a.actors.find((actor) => actor.ecotype === "urban");
  assert.ok(marsh && urban);
  Object.assign(player, { x: marsh.x, z: marsh.z + 2.5, vx: 1, vz: 0 });
  for (let i = 0; i < 10; i++) a.step(1 / 60, player, "frontier", state.squirtleEcology, state.memory, env);
  assert.ok(["hide", "flee"].includes(marsh.mode));
  urban.trust = 0.8;
  Object.assign(player, { x: urban.x, z: urban.z + 1.5, vx: 0, vz: 0 });
  for (let i = 0; i < 10; i++) a.step(1 / 60, player, "frontier", state.squirtleEcology, state.memory, env);
  assert.ok(["watch", "rest", "socialize"].includes(urban.mode));
});

test("Shucker evidence and nearby Squirtle behavior require real active pressure", () => {
  const state = new WorldState(),
    near = new NearConspecifics(state.seed),
    player = body(-13, -10);
  rich(state);
  state.squirtleEcology.shuckerPressure = 0;
  state.squirtleEcology.shuckerTicks = 0;
  state.squirtleEcology.abundance.urban = 1;
  state.squirtleEcology.bumpRevision();
  assert.equal(state.squirtleEcology.shuckerEvidence(), null);
  near.step(1 / 60, player, "frontier", state.squirtleEcology, state.memory, env);
  assert.ok(near.actors.some((actor) => actor.active));

  state.squirtleEcology.induceShuckerPressure(0.85, 60);
  const evidence = state.squirtleEcology.shuckerEvidence();
  assert.equal(evidence.type, "shucker");
  for (let i = 0; i < 10; i++)
    near.step(1 / 60, player, "frontier", state.squirtleEcology, state.memory, env);
  assert.ok(
    near.actors.some(
      (actor) =>
        actor.active &&
        actor.cause === "shucker" &&
        ["hide", "flee"].includes(actor.mode),
    ),
  );
});

test("meaningful calm contact promotes bounded notable Squirtles and restored fields are validated", () => {
  const state = new WorldState();
  rich(state);
  state.squirtleEcology.abundance.marsh = 1;
  state.squirtleEcology.bumpRevision();
  const near = new NearConspecifics(state.seed), player = body(-6, -15);
  near.step(1 / 60, player, "frontier", state.squirtleEcology, state.memory, env);
  const actor = near.actors.find((candidate) => candidate.active);
  assert.ok(actor);
  for (let tick = 1; tick <= 14; tick++) {
    player.x = actor.x;
    player.z = actor.z + 2;
    near.step(1 / 60, player, "frontier", state.squirtleEcology, state.memory, env);
    near.observe(player, state.memory, tick);
  }
  assert.ok(state.memory.squirtles.some((record) => record.id === actor.id));
  assert.ok(state.memory.squirtles.length <= 4);
});

test("notable conspecific storage hard-stops at four semantic records", () => {
  const state = new WorldState();
  for (let i = 0; i < 5; i++) {
    const record = state.memory.rememberConspecific({
      id: `sq-marsh-reed-shallows-${i}-abc`,
      ecotype: "marsh",
      habitatId: "reed-shallows",
      marking: i,
      encounters: 2,
      familiarity: 0.5,
      fear: 0.1,
      trust: 0.5,
    }, i + 1);
    if (i < 4) assert.ok(record);
    else assert.equal(record, null);
  }
  assert.equal(state.memory.squirtles.length, 4);
});

test("save v7 round-trips, v1-v6 migrate empty history, invalid v7 rejects and offline advances ecology", () => {
  const st = storage(), a = new WorldState();
  rich(a);
  a.squirtleEcology.induceShuckerPressure(0.7, 30);
  assert.equal(a.version, 7);
  assert.equal(save(a, st, 1000).ok, true);
  const b = new WorldState();
  assert.equal(load(b, st, { now: 1000, offline: false }).ok, true);
  assert.deepEqual(b.snapshot(), a.snapshot());
  const current = JSON.parse(st.getItem(SAVE_KEY));
  for (let version = 1; version <= 6; version++) {
    const legacy = structuredClone(current);
    legacy.version = version;
    delete legacy.squirtles;
    if (version < 6) delete legacy.pose;
    if (version < 5) delete legacy.settlement;
    if (version < 4) { delete legacy.frontier; delete legacy.memory; }
    if (version < 3) { delete legacy.ecosystem; delete legacy.savedAt; delete legacy.ecoRemainder; delete legacy.place; delete legacy.frontierReturn; }
    if (version === 1) delete legacy.watershed;
    const migrated = new WorldState();
    const result = load(migrated, { getItem: () => JSON.stringify(legacy) }, { offline: false });
    assert.equal(result.ok, true, `v${version} migrates`);
    assert.deepEqual(migrated.memory.squirtles, []);
  }
  const forged = structuredClone(current);
  forged.squirtles.shuckerPressure = 9;
  const c = new WorldState(), before = c.snapshot();
  assert.equal(load(c, { getItem: () => JSON.stringify(forged) }, { offline: false }).ok, false);
  assert.deepEqual(c.snapshot(), before);
  const tick = b.squirtleEcology.tickCount;
  advanceOffline(b, 20);
  assert.ok(b.squirtleEcology.tickCount >= tick + 20);
});
