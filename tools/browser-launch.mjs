import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { brotliDecompressSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export async function launchBrowser() {
 const launch = { headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
 if (process.env.BROWSER_EXECUTABLE) launch.executablePath = process.env.BROWSER_EXECUTABLE;
 else if (process.env.BROWSER_BUNDLED === '1') {
  const bundled = (await import('@sparticuz/chromium')).default;
  launch.executablePath = await bundled.executablePath();
  // Minimal containers can lack NSS/NSPR. These compatible libraries ship in the
  // pinned browser package. Extract only to temporary tooling storage, never Git.
  const directory = join(tmpdir(), 'sf-chromium-140-libs');
  await mkdir(directory, { recursive: true });
  if (!existsSync(join(directory, 'lib/libnspr4.so'))) {
   const packed = require.resolve('@sparticuz/chromium').replace(/build\/cjs\/index\.cjs$/, 'bin/al2023.tar.br');
   const tar = join(directory, 'libraries.tar');
   await writeFile(tar, brotliDecompressSync(await readFile(packed)));
   execFileSync('tar', ['-xf', tar, '-C', directory]);
  }
  launch.env = { ...process.env, LD_LIBRARY_PATH: [join(directory, 'lib'), process.env.LD_LIBRARY_PATH].filter(Boolean).join(delimiter) };
 }
 return chromium.launch(launch);
}
