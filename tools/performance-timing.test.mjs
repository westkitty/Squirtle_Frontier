import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertCompatibleDependencies,
  assertMatchedTiming,
  evaluateMatchedTiming,
} from "./performance-timing.mjs";

const fixedWorkload = Object.freeze({
  quality: "high",
  adaptiveEnabled: false,
  adaptiveValue: 1,
  pixelRatio: 1,
  buffer: "960x640",
});

const budget = {
  toleranceMs: 8.4,
  protectedWorkload: fixedWorkload,
  confirmationPairs: 4,
  diagnosticWindows: 2,
  scenarios: {
    high: { medianMs: 33.4, p95Ms: 50.1 },
    channelCut: { medianMs: 33.4, p95Ms: 50.1 },
    channelDistant: { medianMs: 16.8, p95Ms: 33.4 },
    squirtles: { medianMs: 16.8, p95Ms: 33.4 },
  },
};

const ORDERS = [
  "baseline-candidate",
  "candidate-baseline",
  "candidate-baseline",
  "baseline-candidate",
];

function sample(medianMs, p95Ms, windows = [[medianMs, p95Ms], [medianMs, p95Ms]]) {
  return {
    samples: 110,
    workload: { ...fixedWorkload },
    medianMs,
    p95Ms,
    windows: windows.map(([median, p95]) => ({ medianMs: median, p95Ms: p95 })),
  };
}

function evidence(medianMs = 33.4, p95Ms = 50.1, overrides = {}) {
  const normal = sample(medianMs, p95Ms);
  return {
    environment: "same runner",
    scenarios: [{ quality: "high", ...normal }],
    channelCut: { ...normal },
    channelDistant: { ...normal },
    squirtles: { ...normal },
    ...overrides,
  };
}

function pair(order, baseline, candidate) {
  return { order, baseline, candidate };
}

function explicitPairs(entries) {
  return entries.map(([baseline, candidate], index) =>
    pair(ORDERS[index], baseline, candidate),
  );
}

function balancedPairs(firstBaseline, firstCandidate, secondBaseline, secondCandidate) {
  return explicitPairs([
    [firstBaseline, firstCandidate],
    [secondBaseline, secondCandidate],
    [secondBaseline, secondCandidate],
    [firstBaseline, firstCandidate],
  ]);
}

function run(pairs) {
  return evaluateMatchedTiming({
    pairs,
    budget,
    baselineRevision: "base",
    candidateRevision: "head",
  });
}

test("equal counterbalanced measurements pass", () => {
  const same = evidence();
  assert.equal(run(balancedPairs(same, same, same, same)).verdict, "PASS");
});

test("small matched variation inside tolerance passes in every pair", () => {
  const baseline = evidence();
  const candidate = evidence(41.7, 58.4);
  assert.equal(run(balancedPairs(baseline, candidate, baseline, candidate)).verdict, "PASS");
});

test("two unexplained breaching pairs remain inconclusive rather than passing", () => {
  const baseline = evidence();
  const noisy = evidence(33.4, 66.8);
  const pairs = balancedPairs(baseline, noisy, baseline, baseline);
  const result = run(pairs);
  assert.equal(result.scenarios.high.metricEvidence.p95Ms.breachCount, 2);
  assert.equal(result.scenarios.high.metricVerdicts.p95Ms, "INCONCLUSIVE");
  assert.equal(result.scenarios.high.verdict, "INCONCLUSIVE");
  assert.equal(result.verdict, "INCONCLUSIVE");
  assert.throws(
    () => assertMatchedTiming({ pairs, budget, baselineRevision: "base", candidateRevision: "head" }),
    /evidence is inconclusive/,
  );
});

test("replicated majority median regression fails", () => {
  const baseline = evidence();
  const candidate = evidence(50.1, 50.1);
  const clean = evidence();
  const pairs = explicitPairs([
    [baseline, candidate],
    [baseline, candidate],
    [baseline, candidate],
    [baseline, clean],
  ]);
  const result = run(pairs);
  assert.equal(result.scenarios.high.metricEvidence.medianMs.breachCount, 3);
  assert.equal(result.scenarios.high.metricEvidence.medianMs.requiredFailureCount, 3);
  assert.equal(result.scenarios.high.metricVerdicts.medianMs, "FAIL");
  assert.equal(result.verdict, "FAIL");
  assert.throws(
    () => assertMatchedTiming({ pairs, budget, baselineRevision: "base", candidateRevision: "head" }),
    /replicated majority/,
  );
});

test("one isolated p95 bucket breach is retained but does not establish a regression", () => {
  const baseline = evidence(33.4, 50.1);
  const noisy = evidence(33.4, 66.8);
  const pairs = explicitPairs([
    [baseline, noisy],
    [baseline, baseline],
    [baseline, baseline],
    [baseline, baseline],
  ]);
  const result = run(pairs);
  assert.equal(result.scenarios.high.metricEvidence.p95Ms.breachCount, 1);
  assert.deepEqual(result.scenarios.high.metricEvidence.p95Ms.deltas, [16.7, 0, 0, 0]);
  assert.equal(result.scenarios.high.metricVerdicts.p95Ms, "PASS");
  assert.equal(result.verdict, "PASS");
});

test("counterbalancing identifies symmetric order drift when signs reverse", () => {
  const fast = evidence(66.6, 100.0);
  const slow = evidence(83.3, 116.7);
  const pairs = explicitPairs([
    [fast, slow],
    [slow, fast],
    [slow, fast],
    [fast, slow],
  ]);
  const result = run(pairs);
  assert.equal(result.scenarios.high.metricEvidence.p95Ms.breachCount, 2);
  assert.equal(result.scenarios.high.metricEvidence.p95Ms.improvementCount, 2);
  assert.equal(result.scenarios.high.metricVerdicts.p95Ms, "ORDER_VARIANCE");
  assert.equal(result.scenarios.high.orderVariance, true);
  assert.ok(result.orderSensitive.includes("high"));
  assert.equal(result.scenarios.high.verdict, "PASS");
  assert.equal(result.verdict, "PASS");
});

test("sign reversal cannot pass when the counterbalanced delta still exceeds tolerance", () => {
  const baselineA = evidence(66.6, 100.0);
  const candidateA = evidence(83.3, 150.0);
  const baselineB = evidence(83.3, 133.4);
  const candidateB = evidence(66.6, 116.7);
  const pairs = balancedPairs(baselineA, candidateA, baselineB, candidateB);
  const result = run(pairs);
  assert.equal(result.scenarios.high.metricEvidence.p95Ms.breachCount, 2);
  assert.equal(result.scenarios.high.metricEvidence.p95Ms.improvementCount, 2);
  assert.equal(result.scenarios.high.pairedDelta.p95Ms, 16.7);
  assert.equal(result.scenarios.high.metricVerdicts.p95Ms, "INCONCLUSIVE");
  assert.equal(result.verdict, "INCONCLUSIVE");
});

test("a real regression survives one opposing outlier", () => {
  const baseline = evidence(66.6, 100.0);
  const candidate = evidence(83.3, 133.4);
  const better = evidence(66.6, 83.3);
  const pairs = explicitPairs([
    [baseline, candidate],
    [baseline, candidate],
    [baseline, candidate],
    [baseline, better],
  ]);
  const result = run(pairs);
  assert.equal(result.scenarios.high.metricEvidence.p95Ms.breachCount, 3);
  assert.equal(result.scenarios.high.metricVerdicts.p95Ms, "FAIL");
  assert.equal(result.verdict, "FAIL");
});

test("diagnostic window bucket order cannot manufacture a whole-run failure", () => {
  const baselineDistant = sample(66.6, 100.0, [[66.6, 66.7], [66.6, 116.6]]);
  const candidateDistant = sample(66.6, 100.1, [[50.1, 116.6], [66.6, 66.7]]);
  const baseline = evidence(33.4, 50.1, { channelDistant: baselineDistant });
  const candidate = evidence(33.4, 50.1, { channelDistant: candidateDistant });
  const result = run(balancedPairs(baseline, candidate, baseline, candidate));
  assert.equal(result.scenarios.channelDistant.pairedDelta.p95Ms, 0.1);
  assert.equal(result.scenarios.channelDistant.verdict, "PASS");
  assert.equal(result.verdict, "PASS");
});

test("matched timing rejects adaptive-resolution workload contamination", () => {
  const baseline = evidence();
  const candidate = evidence();
  candidate.channelCut.workload = {
    quality: "high",
    adaptiveEnabled: true,
    adaptiveValue: 0.85,
    pixelRatio: 0.85,
    buffer: "816x544",
  };
  assert.throws(
    () => run(balancedPairs(baseline, candidate, baseline, baseline)),
    /baseline\/candidate workloads differ/,
  );

  const bothContaminated = evidence();
  bothContaminated.channelCut.workload = { ...candidate.channelCut.workload };
  assert.throws(
    () => run(balancedPairs(bothContaminated, bothContaminated, baseline, baseline)),
    /does not match the protected timing workload/,
  );
});

test("unbalanced execution order is rejected instead of pretending to be counterbalanced", () => {
  const baseline = evidence();
  const candidate = evidence();
  assert.throws(
    () =>
      run([
        pair("baseline-candidate", baseline, candidate),
        pair("baseline-candidate", baseline, candidate),
        pair("baseline-candidate", baseline, candidate),
        pair("candidate-baseline", baseline, candidate),
      ]),
    /requires exactly 2 baseline-candidate and 2 candidate-baseline pairs/,
  );
});

test("protected windows are fixed and malformed evidence fails explicitly", () => {
  const samplerSource = readFileSync(new URL("./movement-perf.mjs", import.meta.url), "utf8");
  assert.equal(
    samplerSource.match(/raw = s\.frames\.slice\(10, 120\),/g)?.length,
    2,
    "high/low and protected scene timing must each use an exact 110-frame window after 10 warm-up frames",
  );

  const malformed = evidence();
  malformed.scenarios[0].windows = [{ medianMs: 33.4, p95Ms: 50.1 }];
  assert.throws(
    () => run(balancedPairs(malformed, evidence(), evidence(), evidence())),
    /exactly 2 diagnostic windows/,
  );

  const missing = evidence();
  delete missing.channelCut;
  assert.throws(
    () => run(balancedPairs(missing, evidence(), evidence(), evidence())),
    /missing scenario channelCut/,
  );

  const mismatch = evidence();
  mismatch.channelDistant.samples = 109;
  assert.throws(
    () => run(balancedPairs(evidence(), mismatch, evidence(), evidence())),
    /sample counts differ/,
  );
});

test("dependency compatibility ignores script-only package drift", () => {
  const baselinePackage = {
    scripts: { perf: "old" },
    dependencies: { three: "0.160.1" },
    devDependencies: { vite: "6.4.3" },
  };
  const candidatePackage = {
    scripts: { perf: "new" },
    dependencies: { three: "0.160.1" },
    devDependencies: { vite: "6.4.3" },
  };
  assert.doesNotThrow(() =>
    assertCompatibleDependencies({
      baselinePackage,
      candidatePackage,
      baselineLock: "same-lock",
      candidateLock: "same-lock",
    }),
  );
});

test("dependency or lock drift is rejected", () => {
  const base = {
    dependencies: { three: "0.160.1" },
    devDependencies: { vite: "6.4.3" },
  };
  assert.throws(
    () =>
      assertCompatibleDependencies({
        baselinePackage: base,
        candidatePackage: { ...base, dependencies: { three: "0.161.0" } },
        baselineLock: "same-lock",
        candidateLock: "same-lock",
      }),
    /dependencies\/devDependencies differ/,
  );
  assert.throws(
    () =>
      assertCompatibleDependencies({
        baselinePackage: base,
        candidatePackage: base,
        baselineLock: "base-lock",
        candidateLock: "candidate-lock",
      }),
    /package-lock\.json differ/,
  );
});
