import validator from "gltf-validator";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const path = "public/assets/runtime/squirtle/squirtle.glb";
const bytes = await readFile(path);
const result = await validator.validateBytes(bytes, { uri: "squirtle.glb" });
await writeFile(
  "docs/assets/gltf-validation.json",
  JSON.stringify(result, null, 2) + "\n",
);
assert.equal(result.issues.numErrors, 0);
const manifest = JSON.parse(
  await readFile("public/assets/manifest.json", "utf8"),
);
assert.equal(
  manifest.assets[0].sha256,
  createHash("sha256").update(bytes).digest("hex"),
);
assert.ok(bytes.length < 2 * 1024 * 1024);
console.log(
  `GLB validated: ${bytes.length} bytes; ${result.issues.numWarnings} documented warnings`,
);
