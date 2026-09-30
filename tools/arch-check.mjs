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
for (const path of await files('src')) {
 const checked = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
 assert.equal(checked.status, 0, `${path}: ${checked.stderr}`);
 const code = await readFile(path, 'utf8');
 assert.ok(!/requestAnimationFrame|setInterval\(/.test(code), `unexpected scheduler: ${path}`);
 if (path !== 'src/main.js') assert.ok(!code.includes('setAnimationLoop('), `loop authority: ${path}`);
 if (/worldstate|persistence|worldgen/.test(path)) assert.ok(!/from ['"]three|pm0007|Squirtle/.test(code), `presentation coupling: ${path}`);
}
console.log('All source syntax and focused Phase 0 architecture checks passed.');
