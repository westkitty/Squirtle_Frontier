import { execFileSync, spawn } from "node:child_process";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
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
  assertMatchedTiming,
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
const baselineEvidencePath = join(tempRoot, "baseline.json");
const candidateEvidencePath = join(tempRoot, "candidate.json");
const artifactDir = join(root, "artifacts/performance");
mkdirSync(artifactDir, { recursive: true });

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
  const log = createWriteStream(join(artifactDir, `${label}-vite.log`), {
    flags: "w",
  });
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
      stdio: ["ignore", log, log],
    },
  );
  await waitForServer(`http://127.0.0.1:${port}/`, child);
  return { child, log };
}

async function stopServer(server) {
  if (!server) return;
  const { child, log } = server;
  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolveClose) => child.once("close", resolveClose)),
      new Promise((resolveWait) => setTimeout(resolveWait, 3000)),
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
  await new Promise((resolveClose) => log.end(resolveClose));
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

let baselineServer;
let candidateServer;
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

  baselineServer = await startServer(baselineRoot, "baseline");
  runRaw(baselineEvidencePath, "baseline", true);
  await stopServer(baselineServer);
  baselineServer = null;

  candidateServer = await startServer(root, "candidate");
  runRaw(candidateEvidencePath, "candidate", false);
  await stopServer(candidateServer);
  candidateServer = null;

  const baseline = JSON.parse(readFileSync(baselineEvidencePath, "utf8"));
  const candidate = JSON.parse(readFileSync(candidateEvidencePath, "utf8"));
  const baselineRenderer = baseline.scenarios?.find(
    (scenario) => scenario.quality === "high",
  )?.renderer;
  const candidateRenderer = candidate.scenarios?.find(
    (scenario) => scenario.quality === "high",
  )?.renderer;
  if (
    !baselineRenderer ||
    !candidateRenderer ||
    baselineRenderer !== candidateRenderer
  ) {
    throw new Error(
      "baseline and candidate renderer identities differ; matched benchmark is invalid",
    );
  }

  const timing = assertMatchedTiming({
    baseline,
    candidate,
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
    renderer: candidateRenderer,
    dependencies: dependencyProof,
    baselineEvidence: baseline,
    candidateEvidence: candidate,
  };

  writeFileSync(
    join(root, "docs/performance/phase1-measured.json"),
    JSON.stringify(candidate, null, 2) + "\n",
  );
  writeFileSync(
    join(artifactDir, "baseline-evidence.json"),
    JSON.stringify(baseline, null, 2) + "\n",
  );
  writeFileSync(
    join(artifactDir, "candidate-evidence.json"),
    JSON.stringify(candidate, null, 2) + "\n",
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
        scenarios: Object.fromEntries(
          Object.entries(report.scenarios).map(([name, value]) => [
            name,
            {
              baseline: value.baseline,
              candidate: value.candidate,
              delta: value.delta,
              verdict: value.verdict,
            },
          ]),
        ),
      },
      null,
      2,
    ),
  );
} finally {
  await stopServer(baselineServer);
  await stopServer(candidateServer);
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
