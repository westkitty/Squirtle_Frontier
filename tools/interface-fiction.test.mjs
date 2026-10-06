import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("public interface presents Stillwater as a living world rather than a diagnostic study", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(
    html,
    /movement proving ground|MOVEMENT STUDY \/ 01|Early watershed study|Current Sense|amber ripple|X = Sense/i,
  );
  assert.match(html, /persistent living frontier/i);
  assert.match(html, /STILLWATER REACH \/ FIELD NOTES/);
  assert.match(
    html,
    /Water, weather, animals and people respond to persistent world state/i,
  );
});
