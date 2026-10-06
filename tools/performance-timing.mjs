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

function requireScenario(evidence, label, diagnosticWindows, side) {
  const reader = SCENARIO_READERS[label];
  if (!reader) throw new Error(`unknown performance scenario: ${label}`);
  const scenario = reader(evidence);
  if (!scenario) throw new Error(`${side} evidence is missing scenario ${label}`);
  if (!Number.isInteger(scenario.samples) || scenario.samples <= 0) {
    throw new Error(`${side} ${label} samples must be a positive integer`);
  }
  if (!Array.isArray(scenario.windows) || scenario.windows.length !== diagnosticWindows) {
    throw new Error(`${side} ${label} must contain exactly ${diagnosticWindows} diagnostic windows`);
  }
  const windows = scenario.windows.map((window, index) => ({
    medianMs: requireFinite(
      window?.medianMs,
      `${side} ${label} window ${index + 1} medianMs must be finite`,
    ),
    p95Ms: requireFinite(
      window?.p95Ms,
      `${side} ${label} window ${index + 1} p95Ms must be finite`,
    ),
  }));
  return {
    samples: scenario.samples,
    medianMs: requireFinite(scenario.medianMs, `${side} ${label} medianMs must be finite`),
    p95Ms: requireFinite(scenario.p95Ms, `${side} ${label} p95Ms must be finite`),
    windows,
  };
}

function roundMs(value) {
  return Math.round(value * 10) / 10;
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function requireCounterbalancedPairs(pairs, confirmationPairs) {
  if (!Array.isArray(pairs) || pairs.length !== confirmationPairs) {
    throw new Error(`matched timing requires exactly ${confirmationPairs} independent confirmation pairs`);
  }
  const validOrders = new Set(["baseline-candidate", "candidate-baseline"]);
  const seenOrders = new Set();
  for (const [index, pair] of pairs.entries()) {
    if (!pair?.baseline || !pair?.candidate) {
      throw new Error(`confirmation pair ${index + 1} requires baseline and candidate evidence`);
    }
    if (!validOrders.has(pair.order)) {
      throw new Error(`confirmation pair ${index + 1} has invalid order: ${pair.order}`);
    }
    seenOrders.add(pair.order);
  }
  if (!seenOrders.has("baseline-candidate") || !seenOrders.has("candidate-baseline")) {
    throw new Error("matched timing requires both baseline-candidate and candidate-baseline order");
  }
  return pairs;
}

function classifyMetric(comparisons, key, toleranceMs) {
  const deltas = comparisons.map((comparison) => comparison.delta[key]);
  const over = deltas.filter((delta) => delta > toleranceMs).length;
  const opposite = deltas.some((delta) => delta < -toleranceMs);
  if (over === deltas.length) return "FAIL";
  if (over === 0) return "PASS";
  if (opposite) return "ORDER_VARIANCE";
  return "INCONCLUSIVE";
}

export function evaluateMatchedTiming({ pairs, budget, baselineRevision, candidateRevision }) {
  const toleranceMs = requireFinite(budget?.toleranceMs, "timing toleranceMs must be finite");
  const confirmationPairs = budget?.confirmationPairs;
  const diagnosticWindows = budget?.diagnosticWindows ?? 2;
  if (!Number.isInteger(confirmationPairs) || confirmationPairs < 2) {
    throw new Error("confirmationPairs must be an integer >= 2");
  }
  if (!Number.isInteger(diagnosticWindows) || diagnosticWindows < 1) {
    throw new Error("diagnosticWindows must be an integer >= 1");
  }
  const matchedPairs = requireCounterbalancedPairs(pairs, confirmationPairs);
  const scenarioNames = Object.keys(budget?.scenarios ?? {});
  if (scenarioNames.length === 0) throw new Error("timing budget must declare protected scenarios");

  const scenarios = {};
  const failures = [];
  const inconclusive = [];
  const orderSensitive = [];
  for (const label of scenarioNames) {
    const comparisons = matchedPairs.map((pair, index) => {
      const base = requireScenario(
        pair.baseline,
        label,
        diagnosticWindows,
        `pair ${index + 1} baseline`,
      );
      const next = requireScenario(
        pair.candidate,
        label,
        diagnosticWindows,
        `pair ${index + 1} candidate`,
      );
      if (base.samples !== next.samples) {
        throw new Error(
          `pair ${index + 1} ${label} sample counts differ: ${base.samples} baseline vs ${next.samples} candidate`,
        );
      }
      return {
        pair: index + 1,
        order: pair.order,
        baseline: {
          samples: base.samples,
          medianMs: base.medianMs,
          p95Ms: base.p95Ms,
          windows: base.windows,
        },
        candidate: {
          samples: next.samples,
          medianMs: next.medianMs,
          p95Ms: next.p95Ms,
          windows: next.windows,
        },
        delta: {
          medianMs: roundMs(next.medianMs - base.medianMs),
          p95Ms: roundMs(next.p95Ms - base.p95Ms),
        },
      };
    });

    const medianVerdict = classifyMetric(comparisons, "medianMs", toleranceMs);
    const p95Verdict = classifyMetric(comparisons, "p95Ms", toleranceMs);
    const failed = medianVerdict === "FAIL" || p95Verdict === "FAIL";
    const ambiguous =
      !failed &&
      (medianVerdict === "INCONCLUSIVE" || p95Verdict === "INCONCLUSIVE");
    const orderVariance =
      medianVerdict === "ORDER_VARIANCE" || p95Verdict === "ORDER_VARIANCE";
    const verdict = failed ? "FAIL" : ambiguous ? "INCONCLUSIVE" : "PASS";

    if (failed) failures.push(label);
    if (ambiguous) inconclusive.push(label);
    if (orderVariance) orderSensitive.push(label);

    scenarios[label] = {
      historicalReference: budget.scenarios[label],
      toleranceMs,
      pairedDelta: {
        medianMs: roundMs(median(comparisons.map((comparison) => comparison.delta.medianMs))),
        p95Ms: roundMs(median(comparisons.map((comparison) => comparison.delta.p95Ms))),
      },
      comparisons,
      metricVerdicts: {
        medianMs: medianVerdict,
        p95Ms: p95Verdict,
      },
      orderVariance,
      verdict,
    };
  }

  return {
    comparisonMode: "same-runner-counterbalanced-pairs",
    baselineRevision,
    candidateRevision,
    environment: pairs?.[0]?.candidate?.environment ?? pairs?.[0]?.baseline?.environment ?? null,
    disclaimer:
      "SwiftShader/software-renderer measurements are relative regression evidence, not representative hardware/mobile FPS.",
    toleranceMs,
    confirmationPairs,
    diagnosticWindows,
    scenarios,
    failures,
    inconclusive,
    orderSensitive,
    verdict:
      failures.length > 0
        ? "FAIL"
        : inconclusive.length > 0
          ? "INCONCLUSIVE"
          : "PASS",
  };
}

export function assertMatchedTiming(args) {
  const report = evaluateMatchedTiming(args);
  if (report.failures.length > 0) {
    throw new Error(
      `matched performance regression exceeded ${report.toleranceMs} ms in both counterbalanced pairs for: ${report.failures.join(", ")}`,
    );
  }
  if (report.inconclusive.length > 0) {
    throw new Error(
      `matched performance evidence is inconclusive across counterbalanced pairs for: ${report.inconclusive.join(", ")}`,
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
