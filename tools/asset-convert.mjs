import { launchBrowser } from "./browser-launch.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
// Extract selected source locally; preserve the archive and never alter source repositories.
execFileSync("python3", [
  "-c",
  `import zipfile,pathlib
z=zipfile.ZipFile('assets/source/squirtle/Archive.zip')
for n in z.namelist():
 if n.startswith('source/Pokemon XY/Squirtle/') and not n.endswith('/') and '.DS_Store' not in n:
  p=pathlib.Path('.asset-work')/n.split('Squirtle/',1)[1];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(z.read(n))`,
]);
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  page.on("console", (m) => console.log(m.type(), m.text()));
  page.on("pageerror", console.error);
  await page.goto("http://127.0.0.1:5173/tools/asset-convert.html");
  await page.waitForFunction(() => window.convert);
  const { bytes, report } = await page.evaluate(() => window.convert());
  await mkdir("public/assets/runtime/squirtle", { recursive: true });
  await writeFile(
    "public/assets/runtime/squirtle/squirtle.glb",
    Buffer.from(bytes),
  );
  await writeFile(
    "docs/assets/runtime-inspection.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      bytes: report.bytes,
      min: report.roundtrip.min,
      max: report.roundtrip.max,
      bones: report.roundtrip.bones.length,
    }),
  );
} finally {
  await browser.close();
}
