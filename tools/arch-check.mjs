import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
async function files(dir) {
 const result = [];
 for (const e of await readdir(dir, { withFileTypes: true })) {
  const path = `${dir}/${e.name}`;
  if (e.isDirectory()) result.push(...await files(path));
  else if (path.endsWith('.js')) result.push(path);
 }
 return result;
}
const imported = /import\s+(?:([\w$]+)\s*,\s*)?\{([^}]*)\}\s+from\s+['"](\.[^'"]*)['"]/g;
for (const path of await files('src')) {
 const checked = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
 assert.equal(checked.status, 0, `${path}: ${checked.stderr}`);
 const code = await readFile(path, 'utf8');
 assert.ok(!/requestAnimationFrame|setInterval\(/.test(code), `unexpected scheduler: ${path}`);
 if (path !== 'src/main.js') assert.ok(!code.includes('setAnimationLoop('), `loop authority: ${path}`);
 if (/worldstate|persistence|worldgen|simulation/.test(path)) assert.ok(!/from ['"]three|pm0007|Squirtle/.test(code), `presentation coupling: ${path}`);
 // A symbol imported from a sibling module and never used again is how a stale edit hides:
 // the file still parses, the tests still pass, and the behaviour the docs describe is simply
 // gone. So every named import from a relative module has to be referenced at least once more.
 for (const m of code.matchAll(imported)) {
  for (const raw of m[2].split(',')) {
   const name = raw.trim().split(/\s+as\s+/).pop().replace(/,/g, '').trim();
   if (!/^[\w$]+$/.test(name)) continue;
   const uses = (code.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
   assert.ok(uses >= 2, `unused import ${name}: ${path}`);
  }
 }
}
console.log('All source syntax and focused Phase 0 architecture checks passed.');
