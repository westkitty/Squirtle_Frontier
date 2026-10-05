import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEBRIS_SITE as interactionDebris } from "../src/simulation/water-interaction.js";
import { DEBRIS_SITE, WETLAND_SITE, LAB_ENTRY_SITE } from "../src/simulation/regional-sites.js";
import { WETLAND } from "../src/player/habitat-view.js";
import { regionalAmbienceAt } from "../src/audio.js";

test("visual and acoustic region logic share canonical site objects", () => {
  assert.strictEqual(interactionDebris, DEBRIS_SITE);
  assert.strictEqual(WETLAND, WETLAND_SITE);
  assert.deepEqual(LAB_ENTRY_SITE, { x: -11, z: 5 });

  const gorge = regionalAmbienceAt(DEBRIS_SITE.x, DEBRIS_SITE.z);
  const oldDrift = regionalAmbienceAt(6, -4);
  assert.ok(gorge.level > oldDrift.level, "canonical debris region must drive gorge ambience");

  const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  const audio = readFileSync(new URL("../src/audio.js", import.meta.url), "utf8");
  assert.match(main, /body\.x - DEBRIS_SITE\.x/);
  assert.match(audio, /DEBRIS_SITE\.x/);
});
