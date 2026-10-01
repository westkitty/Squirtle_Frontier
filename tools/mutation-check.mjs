// A suite that passes under a rule and under its negation is not a test of the rule. That is
// how one defect in this project shipped: the loop kept an older hold rule, 105 checks stayed
// green, and only a read of the diff noticed. So this runs the whole unit suite against each
// deliberately broken source file and requires the break to be *named* by a failing test.
//
// Every mutation is a single textual swap that keeps the file syntactically valid: a kill by
// parse error proves the suite runs, not that it understands. Survivors are gaps in the tests,
// not in the code, and each one is a to-do.
import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";

const MUTATIONS = [
  {
    what: "depth leaf keeps two decimals while the screen shows one",
    file: "src/simulation/deep-history.js",
    from: "depth: +finite(depth).toFixed(1),",
    to: "depth: +finite(depth).toFixed(2),",
  },
  {
    what: "cut share rounded again in presentation instead of measurement",
    file: "src/simulation/deep-history.js",
    from: "cutShare: +((cutMetres * 100) / RECORD_DEPTH).toFixed(1),",
    to: "cutShare: +((cutMetres * 100) / RECORD_DEPTH).toFixed(2),",
  },
  {
    what: "the bank above the first band is claimed as a stratum",
    file: "src/simulation/deep-history.js",
    from: "    inBank,\n    bankAbove:",
    to: "    inBank: false,\n    bankAbove:",
  },
  {
    what: "every layer gets a constant thickness, so the last one stops short of the floor",
    file: "src/simulation/deep-history.js",
    from: "return +((next ? next.depth : RECORD_DEPTH) - era.depth).toFixed(6);",
    to: "return +(2.3).toFixed(6);",
  },
  {
    what: "the hold counts only while the body is moving",
    file: "src/simulation/deep-history.js",
    from: "steady = Number.isFinite(vy) && Math.abs(vy) <= STRATA_SETTLE_SPEED;",
    to: "steady = Number.isFinite(vy) && Math.abs(vy) >= STRATA_SETTLE_SPEED;",
  },
  {
    what: "a hold carried from one band to the next",
    file: "src/simulation/deep-history.js",
    from: "if (hold?.band !== band) return { band, held: 0 };",
    to: "if (false) return { band, held: 0 };",
  },
  {
    what: "logging a band twice counts twice",
    file: "src/simulation/place-memory.js",
    from: "this.strata.includes(index)",
    to: "false",
  },
  {
    what: "a saved strata list is trusted without bounds",
    file: "src/simulation/place-memory.js",
    from: "          (n) => !Number.isInteger(n) || n < 0 || n > RECORD_BANDS - 1,",
    to: "          (n) => !Number.isInteger(n),",
  },
  {
    what: "remembered reaches may repeat",
    file: "src/simulation/place-memory.js",
    from: "        !this.reaches.includes(reach.id) &&",
    to: "        true &&",
  },
  {
    what: "the basin level is anchored on the wrong wetland supply",
    file: "src/simulation/water-level.js",
    from: "export const WETLAND_PRISTINE = 0.05;",
    to: "export const WETLAND_PRISTINE = 0.06;",
  },
  {
    what: "the painted shallows sit at the surface instead of above it",
    file: "src/simulation/water-level.js",
    from: "export const WATER_PAINT_LIFT = 0.015;",
    to: "export const WATER_PAINT_LIFT = 0.05;",
  },
  {
    what: "the shaft floor constant drifts from the geometry that uses it",
    file: "src/simulation/deep-history.js",
    from: "export const RECORD_DEPTH = 22;",
    to: "export const RECORD_DEPTH = 21;",
  },
  {
    what: "the painted shallows flood the walkable rim the body stands on",
    file: "src/player/movement-region.js",
    from: "heightAt(x, z) < WATER_SHORELINE(level)",
    to: "heightAt(x, z) < level",
  },
  {
    what: "drink tracks are recorded from anywhere in the watershed",
    file: "src/simulation/place-memory.js",
    from: "if (Math.hypot(site.x - body.x, site.z - body.z) > 10) continue;",
    to: "if (false) continue;",
  },
];

const testFiles = (await readdir("tools"))
  .filter((n) => n.endsWith(".test.mjs"))
  .sort();

function suite() {
  try {
    execFileSync(
      process.execPath,
      ["--test", "--test-reporter=tap", ...testFiles.map((n) => `tools/${n}`)],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return { passed: true, output: "" };
  } catch (error) {
    return {
      passed: false,
      output: `${error.stdout ?? ""}${error.stderr ?? ""}`,
    };
  }
}

const failures = [];
if (!suite().passed) {
  console.error(
    "the unit suite must pass before its mutations can be judged; run `npm test`",
  );
  process.exit(1);
}
const originals = new Map();
for (const mutation of MUTATIONS) {
  if (!originals.has(mutation.file))
    originals.set(mutation.file, await readFile(mutation.file, "utf8"));
  const source = originals.get(mutation.file);
  const hits = source.split(mutation.from).length - 1;
  let verdict, detail;
  if (hits !== 1) {
    verdict = "STALE ANCHOR";
    detail = `${hits} matches for the mutation's text - fix this tool, the source moved`;
    failures.push(mutation.what);
  } else {
    await writeFile(mutation.file, source.replace(mutation.from, mutation.to));
    let result;
    try {
      result = suite();
    } finally {
      await writeFile(mutation.file, source);
    }
    if (result.passed) {
      verdict = "SURVIVED";
      detail = "no test noticed - the suite does not own this behaviour";
      failures.push(mutation.what);
    } else {
      const named = result.output.match(/^not ok \d+ - (.*)$/m);
      const syntax = /SyntaxError|Unexpected token/.test(result.output);
      verdict = syntax ? "killed (parse only)" : "killed";
      detail = named
        ? named[1]
        : "the suite failed without naming a test; check the output";
      if (syntax)
        failures.push(`${mutation.what} (only a parse error caught it)`);
    }
  }
  console.log(
    `${verdict.padEnd(19)} ${mutation.what}\n${" ".repeat(23)}${detail}`,
  );
}
const survivors = failures.length;
console.log(
  `${MUTATIONS.length - survivors}/${MUTATIONS.length} injected defects caught by a named test.` +
    (survivors
      ? ` ${survivors} survived:\n - ${failures.join("\n - ")}`
      : " the suite currently owns every rule this list can break."),
);
if (survivors) process.exit(1);
