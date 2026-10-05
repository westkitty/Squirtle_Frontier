import { createHash } from "node:crypto";

const SCENARIO_READERS = {
  high: (evidence) => evidence?.scenarios?.find((scenario) => scenario.quality === "high"),
  channelCut: (evidence) => evidence?.channelCut,
  channelDistant: (evidence) => evidence?.channelDistant,
  squirtles: (evidence) => evidence?.squirtles,
};

function requireFinite(value, message) {
  if (!Number.isFinite(value)) throw new Error(message);
  return value;
}

function requireScenario(evidence, label, confirmationWindows, side) {
  const reader = SCENARIO_READERS[label];
  if (!reader) throw new Error(`unknown performance scenario: ${label}`);
  const scenario = reader(evidence);
  if (!scenario) throw new Error(`${side} evidence is missing scenario ${label}`);
  if (!Array.isArray(scenario.windows) || scenario.windows.length !== confirmationWindows) {
    throw new Error(`${side} ${label} must contain exactly ${confirmationWindows} confirmation windows`);
  }
  const windows = scenario.windows.map((window, index) => ({
    medianMs: requireFinite(window?.medianMs, `${side} ${label} window ${index + 1} medianMs must be finite`),
    p95Ms: requireFinite(window?.p95Ms, `${side} ${label} window ${index + 1} p95Ms must be finite`),
  }));
  return {
    medianMs: requireFinite(scenario.medianMs, `${side} ${label} medianMs must be finite`),
    p95Ms: requireFinite(scenario.p95Ms, `${side} ${label} p95Ms must be finite`),
    windows,
  };
}

function roundMs(value) {
  return Math.round(value * 10) / 10;
}

export function evaluateMatchedTiming({ baseline, candidate, budget, baselineRevision, candidateRevision }) {
  if (!baseline || !candidate) throw new Error("baseline and candidate evidence are required");
  const toleranceMs = requireFinite(budget?.toleranceMs, "timing toleranceMs must be finite");
  const confirmationWindows = budget?.confirmationWindows;
  if (!Number.isInteger(confirmationWindows) || confirmationWindows < 2) {
    throw new Error("confirmationWindows must be an integer >= 2");
  }
  const scenarioNames = Object.keys(budget?.scenarios ?? {});
  if (scenarioNames.length === 0) throw new Error("timing budget must declare protected scenarios");

  const scenarios = {};
  const failures = [];
  for (const label of scenarioNames) {
    const base = requireScenario(baseline, label, confirmationWindows, "baseline");
    const next = requireScenario(candidate, label, confirmationWindows, "candidate");
    const windows = base.windows.map((baseWindow, index) => {
      const candidateWindow = next.windows[index];
      return {
        baseline: baseWindow,
        candidate: candidateWindow,
        deltaMedianMs: roundMs(candidateWindow.medianMs - baseWindow.medianMs),
        deltaP95Ms: roundMs(candidateWindow.p95Ms - baseWindow.p95Ms),
      };
    });
    const sustainedMedian = windows.every((window) => window.deltaMedianMs > toleranceMs);
    const sustainedP95 = windows.every((window) => window.deltaP95Ms > toleranceMs);
    const failed = sustainedMedian || sustainedP95;
    if (failed) failures.push(label);
    scenarios[label] = {
      historicalReference: budget.scenarios[label],
      baseline: { medianMs: base.medianMs, p95Ms: base.p95Ms },
      candidate: { medianMs: next.medianMs, p95Ms: next.p95Ms },
      delta: {
        medianMs: roundMs(next.medianMs - base.medianMs),
        p95Ms: roundMs(next.p95Ms - base.p95Ms),
      },
      toleranceMs,
      windows,
      sustainedMedian,
      sustainedP95,
      verdict: failed ? "FAIL" : "PASS",
    };
  }

  return {
    comparisonMode: "same-runner-delta",
    baselineRevision,
    candidateRevision,
    environment: candidate.environment ?? baseline.environment ?? null,
    disclaimer:
      "SwiftShader/software-renderer measurements are relative regression evidence, not representative hardware/mobile FPS.",
    toleranceMs,
    confirmationWindows,
    scenarios,
    failures,
    verdict: failures.length === 0 ? "PASS" : "FAIL",
  };
}

export function assertMatchedTiming(args) {
  const report = evaluateMatchedTiming(args);
  if (report.failures.length > 0) {
    throw new Error(
      `matched performance regression exceeded ${report.toleranceMs} ms in: ${report.failures.join(", ")}`,
    );
  }
  return report;
}

function stableDeps(packageJson) {
  return JSON.stringify({
    dependencies: packageJson?.dependencies ?? {},
    devDependencies: packageJson?.devDependencies ?? {},
  });
}

export function dependencyFingerprint(packageJson, lockText) {
  return {
    dependencyManifest: stableDeps(packageJson),
    lockSha256: createHash("sha256").update(lockText).digest("hex"),
  };
}

export function assertCompatibleDependencies({ baselinePackage, candidatePackage, baselineLock, candidateLock }) {
  const baseline = dependencyFingerprint(baselinePackage, baselineLock);
  const candidate = dependencyFingerprint(candidatePackage, candidateLock);
  if (baseline.dependencyManifest !== candidate.dependencyManifest) {
    throw new Error("baseline and candidate dependencies/devDependencies differ; matched benchmark is invalid");
  }
  if (baseline.lockSha256 !== candidate.lockSha256) {
    throw new Error("baseline and candidate package-lock.json differ; matched benchmark is invalid");
  }
  return { baseline, candidate };
}
