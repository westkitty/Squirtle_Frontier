import { execFileSync, spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCompatibleDependencies,
  evaluateMatchedTiming,
} from "./performance-timing.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const budget = JSON.parse(
  readFileSync(join(root, "docs/performance/movement-budget.json"), "utf8"),
);
const baselineRevision = process.env.PERF_BASELINE_REF || budget.baselineRevision;
const candidateRevision = git(["rev-parse", "HEAD"]);
const port = Number(process.env.PERF_MATCHED_PORT || 5187);
const tempRoot = mkdtempSync(join(tmpdir(), "sf-perf-matched-"));
const baselineRoot = join(tempRoot, "baseline");
const artifactDir = join(root, "artifacts/performance");
mkdirSync(artifactDir, { recursive: true });

const schedule = [
  { key: "baseline-a", side: "baseline", pair: 1, order: "baseline-candidate" },
  { key: "candidate-a", side: "candidate", pair: 1, order: "baseline-candidate" },
  { key: "candidate-b", side: "candidate", pair: 2, order: "candidate-baseline" },
  { key: "baseline-b", side: "baseline", pair: 2, order: "candidate-baseline" },
];

function git(args, cwd = root) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function ensureBaselineCommit() {
  try {
    git(["cat-file", "-e", `${baselineRevision}^{commit}`]);
  } catch {
    execFileSync("git", ["fetch", "--no-tags", "origin", baselineRevision], {
      cwd: root,
      stdio: "inherit",
    });
    git(["cat-file", "-e", `${baselineRevision}^{commit}`]);
  }
}

function loadBaselineFile(path) {
  return execFileSync("git", ["show", `${baselineRevision}:${path}`], {
    cwd: root,
    encoding: "utf8",
  });
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 60000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Vite exited before becoming ready (${child.exitCode})`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(
    `Vite did not become ready at ${url}: ${lastError?.message ?? "timeout"}`,
  );
}

async function startServer(cwd, label) {
  const logFd = openSync(join(artifactDir, `${label}-vite.log`), "w");
  const child = spawn(
    process.execPath,
    [
      join(root, "node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd,
      env: process.env,
      stdio: ["ignore", logFd, logFd],
    },
  );
  await waitForServer(`http://127.0.0.1:${port}/`, child);
  return { child, logFd };
}

async function stopServer(server) {
  if (!server) return;
  const { child, logFd } = server;
  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolveClose) => child.once("close", resolveClose)),
      new Promise((resolveWait) => setTimeout(resolveWait, 3000)),
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
  closeSync(logFd);
}

function runRaw(outputPath, role, measureOnly) {
  execFileSync(process.execPath, [join(root, "tools/movement-perf.mjs")], {
    cwd: root,
    env: {
      ...process.env,
      BASE_URL: `http://127.0.0.1:${port}`,
      PERF_EVIDENCE_FILE: outputPath,
      PERF_MEASURE_ROLE: role,
      PERF_MEASURE_ONLY: measureOnly ? "1" : "0",
    },
    stdio: "inherit",
    timeout: 300000,
  });
}

async function measureRun(spec) {
  const outputPath = join(tempRoot, `${spec.key}.json`);
  const cwd = spec.side === "baseline" ? baselineRoot : root;
  let server;
  try {
    server = await startServer(cwd, spec.key);
    runRaw(outputPath, spec.side, spec.side === "baseline");
  } finally {
    await stopServer(server);
    if (existsSync(outputPath)) {
      writeFileSync(
        join(artifactDir, `${spec.key}-evidence.json`),
        readFileSync(outputPath),
      );
    }
  }
  if (!existsSync(outputPath)) {
    throw new Error(`${spec.key} did not produce performance evidence`);
  }
  return JSON.parse(readFileSync(outputPath, "utf8"));
}

function rendererOf(evidence) {
  return evidence.scenarios?.find((scenario) => scenario.quality === "high")?.renderer;
}

let worktreeAdded = false;
try {
  ensureBaselineCommit();

  const baselinePackage = JSON.parse(loadBaselineFile("package.json"));
  const baselineLock = loadBaselineFile("package-lock.json");
  const candidatePackage = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
  );
  const candidateLock = readFileSync(join(root, "package-lock.json"), "utf8");
  const dependencyProof = assertCompatibleDependencies({
    baselinePackage,
    candidatePackage,
    baselineLock,
    candidateLock,
  });

  git(["worktree", "add", "--detach", baselineRoot, baselineRevision]);
  worktreeAdded = true;
  const candidateModules = join(root, "node_modules");
  if (!existsSync(candidateModules)) {
    throw new Error("node_modules is missing; run npm ci before matched performance");
  }
  symlinkSync(candidateModules, join(baselineRoot, "node_modules"), "dir");

  const runs = {};
  for (const spec of schedule) runs[spec.key] = await measureRun(spec);

  const rendererSet = new Set(Object.values(runs).map(rendererOf));
  if (rendererSet.has(undefined) || rendererSet.size !== 1) {
    throw new Error(
      "baseline and candidate renderer identities differ across replicated runs; matched benchmark is invalid",
    );
  }
  const [renderer] = rendererSet;

  const pairs = [
    {
      order: "baseline-candidate",
      baseline: runs["baseline-a"],
      candidate: runs["candidate-a"],
    },
    {
      order: "candidate-baseline",
      baseline: runs["baseline-b"],
      candidate: runs["candidate-b"],
    },
  ];
  const timing = evaluateMatchedTiming({
    pairs,
    budget,
    baselineRevision,
    candidateRevision,
  });
  const report = {
    ...timing,
    runner: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    renderer,
    dependencies: dependencyProof,
    schedule: schedule.map(({ key, side, pair, order }) => ({ key, side, pair, order })),
    runs,
  };

  writeFileSync(
    join(root, "docs/performance/phase1-measured.json"),
    JSON.stringify(runs["candidate-b"], null, 2) + "\n",
  );
  writeFileSync(
    join(artifactDir, "matched-performance.json"),
    JSON.stringify(report, null, 2) + "\n",
  );

  console.log(
    JSON.stringify(
      {
        verdict: report.verdict,
        comparisonMode: report.comparisonMode,
        baselineRevision,
        candidateRevision,
        schedule: report.schedule,
        failures: report.failures,
        inconclusive: report.inconclusive,
        orderSensitive: report.orderSensitive,
        scenarios: Object.fromEntries(
          Object.entries(report.scenarios).map(([name, value]) => [
            name,
            {
              pairedDelta: value.pairedDelta,
              metricVerdicts: value.metricVerdicts,
              orderVariance: value.orderVariance,
              verdict: value.verdict,
              comparisons: value.comparisons.map((comparison) => ({
                pair: comparison.pair,
                order: comparison.order,
                baseline: {
                  medianMs: comparison.baseline.medianMs,
                  p95Ms: comparison.baseline.p95Ms,
                },
                candidate: {
                  medianMs: comparison.candidate.medianMs,
                  p95Ms: comparison.candidate.p95Ms,
                },
                delta: comparison.delta,
              })),
            },
          ]),
        ),
      },
      null,
      2,
    ),
  );

  if (report.verdict === "FAIL") {
    throw new Error(
      `matched performance regression exceeded ${report.toleranceMs} ms in both counterbalanced pairs for: ${report.failures.join(", ")}`,
    );
  }
  if (report.verdict === "INCONCLUSIVE") {
    throw new Error(
      `matched performance evidence remained inconclusive across counterbalanced pairs for: ${report.inconclusive.join(", ")}`,
    );
  }
} finally {
  if (worktreeAdded) {
    rmSync(join(baselineRoot, "node_modules"), { force: true });
    try {
      git(["worktree", "remove", baselineRoot]);
    } catch {
      // Preserve the original benchmark error; prune stale metadata after temp cleanup.
    }
    git(["worktree", "prune"]);
  }
  rmSync(tempRoot, { recursive: true, force: true });
}
