import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NearWildlife,
  MAX_PREY,
  MAX_PREDATORS,
  WILDLIFE_HOME,
} from "../src/simulation/near-wildlife.js";
import {
  Settlement,
  WATER_HOUSE,
  SETTLEMENT_BOWL,
  settlementDialogue,
} from "../src/simulation/settlement.js";
import { placeAction } from "../src/simulation/place-interaction.js";
import { WorldState } from "../src/worldstate.js";
import { save, load, advanceOffline, SAVE_KEY } from "../src/persistence.js";
const env = { obstacles: [] };
const observer = { x: -6, z: -5, vx: 0, vz: 0, jetTime: 0, mode: "land" };
const eco = { prey: 1, predators: 1 };

test("the caretaker's water sense is the cistern: renewal arrives, starvation reads as waiting", () => {
  // Documented (README, docs/qa/WILDLIFE_SETTLEMENT.md): water renewal consumes
  // cistern volume and water reliability changes the caretaker's response. The
  // reliability the settlement acts on has to be the cistern it was actually given.
  const s = new Settlement();
  for (let i = 0; i < 720; i++) s.tick({ cistern: 0.9 });
  assert.ok(
    s.waterReliability > 0.7,
    `reliability must track a fed cistern, got ${s.waterReliability}`,
  );
  s.familiarity = 1;
  assert.equal(s.response, "welcome", "a familiar, water-secure house welcomes");
  for (let i = 0; i < 2000; i++) s.tick({ cistern: 0 });
  assert.ok(
    s.waterReliability < 0.2,
    `a starved cistern must drain reliability, got ${s.waterReliability}`,
  );
  assert.equal(
    s.response,
    "check-water",
    "the same familiar house must wait for water once the cistern is gone",
  );
});

test("the settlement response ladder reads the actual situation, in order", () => {
  const s = new Settlement();
  s.fear = 0.5;
  s.familiarity = 1;
  s.waterReliability = 0;
  assert.equal(
    s.response,
    "withdraw",
    "fear must outrank every water reading",
  );
  s.fear = 0;
  assert.equal(
    s.response,
    "check-water",
    "unreliable water must outrank familiarity: no welcome over an empty trough",
  );
  s.waterReliability = 0.5;
  assert.equal(s.response, "welcome", "water and familiarity together welcome");
  s.familiarity = 0.1;
  assert.equal(s.response, "watch", "strangers are watched, not welcomed");
});

test("near actors follow aggregate budgets, despawn outside radius and never enter saved state", () => {
  const w = new NearWildlife();
  w.step(1 / 60, observer, "frontier", eco, env);
  assert.equal(w.actors.length, MAX_PREY + MAX_PREDATORS);
  w.step(1 / 60, observer, "frontier", { prey: 0.2, predators: 0 }, env);
  assert.equal(w.actors.length, 2);
  w.step(1 / 60, { ...observer, x: 60 }, "frontier", eco, env);
  assert.equal(w.actors.length, 0);
  w.step(1 / 60, observer, "lab", eco, env);
  assert.equal(w.actors.length, 0);
  assert.equal("actors" in new WorldState().snapshot(), false);
});
test("prey evade player and predators while predators stalk instead of orbiting", () => {
  const w = new NearWildlife();
  w.step(1 / 60, observer, "frontier", eco, env);
  const prey = w.actors.find((a) => a.kind === "prey"),
    hunter = w.actors.find((a) => a.kind === "predator");
  Object.assign(prey, { x: -6, z: -15 });
  Object.assign(hunter, { x: -5, z: -15 });
  w.step(1 / 60, observer, "frontier", eco, env);
  assert.equal(prey.mode, "flee");
  assert.ok(prey.vx < 0);
  assert.equal(hunter.mode, "stalk");
  const player = { ...observer, x: prey.x, z: prey.z + 1 };
  w.step(1 / 60, player, "frontier", eco, env);
  assert.equal(prey.mode, "evade");
  assert.ok(prey.vz < 0);
});
test("local simulation repeats deterministically with bounded positions and obstacle separation", () => {
  const a = new NearWildlife(),
    b = new NearWildlife();
  const obstacle = { x: -6, z: -15, radius: 0.5, height: 2 };
  for (let i = 0; i < 3600; i++) {
    for (const w of [a, b])
      w.step(1 / 60, observer, "frontier", eco, { obstacles: [obstacle] });
  }
  assert.deepEqual(a.actors, b.actors);
  for (const actor of a.actors) {
    assert.ok(Math.hypot(actor.x + 6, actor.z + 15) >= 0.68 - 1e-9);
    for (const key of ["x", "z", "vx", "vz", "yaw"])
      assert.ok(Number.isFinite(actor[key]));
  }
});
test("settlement counts distinct visits, learns calm presence, withdraws from jets and allocates bowl water", () => {
  const s = new Settlement(),
    body = { ...observer, x: WATER_HOUSE.x + 3, z: WATER_HOUSE.z + 3 };
  for (let i = 0; i < 70; i++) s.observe(body, "frontier", i);
  assert.equal(s.visits, 1);
  assert.ok(s.familiarity >= 0.25);
  s.observe(body, "lab", 71);
  s.observe(body, "frontier", 72);
  assert.equal(s.visits, 2);
  const e = { cistern: 0.8 };
  s.tick(e);
  assert.ok(s.bowl > 0);
  assert.ok(e.cistern < 0.8);
  for (let i = 73; i < 80; i++)
    s.observe({ ...body, jetTime: 0.2 }, "frontier", i);
  assert.equal(s.response, "withdraw");
  const dry = new Settlement();
  dry.familiarity = 1;
  dry.tick({ cistern: 0 });
  assert.equal(dry.bowl, 0);
});
test("settlement survives save and offline time cannot award familiarity or visits; v4 migrates", () => {
  const a = new WorldState(),
    body = { ...observer, x: -12, z: -9 };
  for (let i = 0; i < 70; i++) a.settlement.observe(body, "frontier", i);
  const m = new Map(),
    storage = { getItem: (k) => m.get(k), setItem: (k, v) => m.set(k, v) };
  save(a, storage, 0);
  const b = new WorldState();
  assert.equal(load(b, storage, { offline: false }).ok, true);
  assert.deepEqual(b.snapshot(), a.snapshot());
  const memory = b.settlement.familiarity,
    visits = b.settlement.visits;
  advanceOffline(b, 600);
  assert.equal(b.settlement.familiarity, memory);
  assert.equal(b.settlement.visits, visits);
  const old = JSON.parse(m.get(SAVE_KEY));
  old.version = 4;
  delete old.settlement;
  m.set(SAVE_KEY, JSON.stringify(old));
  const c = new WorldState();
  assert.equal(load(c, storage, { offline: false }).ok, true);
  assert.equal(c.settlement.visits, 0);
  const bad = {
    ...b.snapshot(),
    savedAt: 0,
    settlement: { ...b.settlement.snapshot(), fear: NaN },
  };
  const before = c.snapshot();
  assert.equal(
    load(c, { getItem: () => JSON.stringify(bad) }, { offline: false }).ok,
    false,
  );
  assert.deepEqual(c.snapshot(), before);
});

test("drinking from the caretaker's bowl requires grounded proximity, familiarity, and consumes bowl volume", () => {
  const s = new Settlement();
  s.familiarity = 0.5;
  s.bowl = 0.8;
  s.fear = 0.2;

  // 1. Far away from bowl
  const farBody = { x: 0, z: 0, grounded: true };
  assert.equal(
    placeAction("frontier", farBody, { settlement: s }),
    null,
    "far body cannot drink",
  );

  // 2. Near bowl but ungrounded (in mid-air jump)
  const airBody = { ...SETTLEMENT_BOWL, grounded: false };
  assert.equal(
    placeAction("frontier", airBody, { settlement: s }),
    null,
    "airborne body cannot drink",
  );

  // 3. Near bowl but stranger (low familiarity)
  const strangerSettlement = new Settlement();
  strangerSettlement.bowl = 0.8;
  strangerSettlement.familiarity = 0.1;
  const groundedBody = { ...SETTLEMENT_BOWL, grounded: true };
  assert.equal(
    placeAction("frontier", groundedBody, { settlement: strangerSettlement }),
    null,
    "unfamiliar creature cannot drink from caretaker's bowl",
  );

  // 4. Near bowl, grounded, familiar, filled bowl
  assert.equal(
    placeAction("frontier", groundedBody, { settlement: s }),
    "drink-bowl",
    "familiar creature near filled bowl gets drink action",
  );

  // 5. Drinking consumes bowl water, increases familiarity and soothes fear
  const initialBowl = s.bowl;
  const initialFam = s.familiarity;
  const initialFear = s.fear;
  assert.equal(s.drinkBowl(), true);
  assert.ok(s.bowl < initialBowl, "drinking must consume bowl volume");
  assert.ok(s.familiarity > initialFam, "drinking must deepen familiarity");
  assert.ok(s.fear < initialFear, "drinking must soothe fear");

  // 6. Empty bowl refuses drink
  s.bowl = 0.01;
  assert.equal(s.drinkBowl(), false, "empty bowl cannot be drunk from");
});

test("in the Lab basin, Squirtle can playfully splash with colonized reed frogs", () => {
  const frogEco = { labFrogs: 3 };
  const noFrogEco = { labFrogs: 0 };

  // 1. In shallow basin with frogs
  const basinBody = { x: 1.5, z: 1.0, y: -0.2 };
  assert.equal(
    placeAction("lab", basinBody, { ecosystem: frogEco }),
    "play-frogs",
    "shallow basin with frogs offers play action",
  );

  // 2. In shallow basin without frogs
  assert.equal(
    placeAction("lab", basinBody, { ecosystem: noFrogEco }),
    null,
    "empty basin without frogs has no play action",
  );

  // 3. Deep submerged dive center (where Deep Record entry is)
  const deepBody = { x: 0, z: 0, y: -1.1 };
  assert.equal(
    placeAction("lab", deepBody, { ecosystem: frogEco }),
    "record",
    "deep shaft entrance retains record action priority",
  );
});

test("settlementDialogue provides context-sensitive ambient voice for all caretaker response modes", () => {
  const s = new Settlement();
  const nearBody = { x: -14, z: -11 }; // within 2m of WATER_HOUSE (-15, -12)
  const farBody = { x: 0, z: 0 }; // far away (> 8m)

  // 1. Distant body gets null
  assert.equal(settlementDialogue(s, farBody), null, "distant body hears nothing");
  assert.equal(settlementDialogue(null, nearBody), null, "missing settlement returns null");

  // 2. Fearful / withdraw mode
  s.fear = 0.5;
  assert.match(settlementDialogue(s, nearBody), /barred/, "fearful response mentions barred door");

  // 3. Drought / check-water mode
  s.fear = 0;
  s.waterReliability = 0.1;
  assert.match(settlementDialogue(s, nearBody), /springs ran true/, "drought response laments dry trough");

  // 4. Stranger / watch mode
  s.waterReliability = 0.8;
  s.familiarity = 0.1;
  assert.match(settlementDialogue(s, nearBody), /observes you quietly/, "stranger response watches quietly");

  // 5. Welcoming mode with bowl filled
  s.familiarity = 0.5;
  s.bowl = 0.6;
  assert.match(settlementDialogue(s, nearBody), /Fresh water for you/, "welcoming mode with bowl gestures to water");

  // 6. Welcoming mode with bowl empty
  s.bowl = 0.02;
  assert.match(settlementDialogue(s, nearBody), /by the cistern/, "welcoming mode without bowl gives warm greeting");

  // 7. Familiar low-fear caretaker explicitly protects instead of giving generic welcome
  s.familiarity = 0.8;
  s.fear = 0;
  s.waterReliability = 0.8;
  assert.equal(s.legalResponse, "protect");
  assert.match(
    settlementDialogue(s, nearBody),
    /watches the road.*Stay near the water house/,
    "protective legal state is visible in ambient behavior",
  );

  // 8. High fear escalates to reporting without inventing combatants
  s.fear = 0.8;
  assert.equal(s.legalResponse, "report");
  assert.match(
    settlementDialogue(s, nearBody),
    /message is being sent beyond the reeds/,
    "reporting is legible as legal pressure rather than an attack spawn",
  );
});


