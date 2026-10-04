import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("public interface presents Stillwater as a world rather than a prototype study", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(
    html,
    /movement proving ground|MOVEMENT STUDY \/ 01|Early watershed study/i,
  );
  assert.match(html, /persistent watershed world/i);
  assert.match(html, /STILLWATER REACH \/ FIELD CURRENT/);
  assert.match(html, /one reach in a larger watershed/i);
});
