import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertCompatibleDependencies,
  assertMatchedTiming,
  evaluateMatchedTiming,
} from "./performance-timing.mjs";

const budget = {
  toleranceMs: 8.4,
  confirmationPairs: 2,
  diagnosticWindows: 2,
  scenarios: {
    high: { medianMs: 33.4, p95Ms: 50.1 },
    channelCut: { medianMs: 33.4, p95Ms: 50.1 },
    channelDistant: { medianMs: 16.8, p95Ms: 33.4 },
    squirtles: { medianMs: 16.8, p95Ms: 33.4 },
  },
};

function sample(medianMs, p95Ms, windows = [[medianMs, p95Ms], [medianMs, p95Ms]]) {
  return {
    samples: 110,
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

function run(pairs) {
  return evaluateMatchedTiming({
    pairs,
    budget,
    baselineRevision: "base",
    candidateRevision: "head",
  });
}

function balancedPairs(firstBaseline, firstCandidate, secondBaseline, secondCandidate) {
  return [
    pair("baseline-candidate", firstBaseline, firstCandidate),
    pair("candidate-baseline", secondBaseline, secondCandidate),
  ];
}

test("equal counterbalanced measurements pass", () => {
  const same = evidence();
  assert.equal(run(balancedPairs(same, same, same, same)).verdict, "PASS");
});

test("small matched variation inside tolerance passes in both orders", () => {
  const baseline = evidence();
  const candidate = evidence(41.7, 58.4);
  assert.equal(run(balancedPairs(baseline, candidate, baseline, candidate)).verdict, "PASS");
});

test("one noisy full-run pair is not a replicated regression", () => {
  const baseline = evidence();
  const noisy = evidence(33.4, 66.8);
  const result = run(balancedPairs(baseline, noisy, baseline, baseline));
  assert.equal(result.scenarios.high.comparisons[0].delta.p95Ms, 16.7);
  assert.equal(result.scenarios.high.comparisons[1].delta.p95Ms, 0);
  assert.equal(result.scenarios.high.sustainedP95, false);
  assert.equal(result.verdict, "PASS");
});

test("the same whole-run median regression in both execution orders fails", () => {
  const baseline = evidence();
  const candidate = evidence(50.1, 50.1);
  const pairs = balancedPairs(baseline, candidate, baseline, candidate);
  const result = run(pairs);
  assert.equal(result.scenarios.high.sustainedMedian, true);
  assert.equal(result.verdict, "FAIL");
  assert.throws(
    () => assertMatchedTiming({ pairs, budget, baselineRevision: "base", candidateRevision: "head" }),
    /both counterbalanced pairs/,
  );
});

test("a replicated roughly one-frame p95 bucket regression fails in both orders", () => {
  const baseline = evidence(33.4, 50.1);
  const candidate = evidence(33.4, 66.8);
  const result = run(balancedPairs(baseline, candidate, baseline, candidate));
  assert.equal(result.scenarios.high.sustainedP95, true);
  assert.equal(result.verdict, "FAIL");
});

test("counterbalancing rejects monotonic runner drift that changes sign with order", () => {
  const firstBaseline = evidence(66.6, 100.0);
  const firstCandidate = evidence(83.3, 116.7);
  const secondCandidate = evidence(66.6, 100.0);
  const secondBaseline = evidence(83.3, 116.7);
  const result = run(
    balancedPairs(firstBaseline, firstCandidate, secondBaseline, secondCandidate),
  );
  assert.equal(result.scenarios.high.comparisons[0].delta.p95Ms, 16.7);
  assert.equal(result.scenarios.high.comparisons[1].delta.p95Ms, -16.7);
  assert.equal(result.scenarios.high.verdict, "PASS");
  assert.equal(result.verdict, "PASS");
});

test("a real regression survives moderate opposing order drift", () => {
  const firstBaseline = evidence(66.6, 100.0);
  const firstCandidate = evidence(83.3, 133.4);
  const secondCandidate = evidence(83.3, 116.7);
  const secondBaseline = evidence(66.6, 100.0);
  const result = run(
    balancedPairs(firstBaseline, firstCandidate, secondBaseline, secondCandidate),
  );
  assert.equal(result.scenarios.high.comparisons[0].delta.p95Ms, 33.4);
  assert.equal(result.scenarios.high.comparisons[1].delta.p95Ms, 16.7);
  assert.equal(result.scenarios.high.sustainedP95, true);
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

test("duplicate execution order is rejected instead of pretending to be independent confirmation", () => {
  const baseline = evidence();
  const candidate = evidence();
  assert.throws(
    () => run([
      pair("baseline-candidate", baseline, candidate),
      pair("baseline-candidate", baseline, candidate),
    ]),
    /requires both baseline-candidate and candidate-baseline order/,
  );
});

test("missing, malformed, or sample-mismatched evidence fails explicitly", () => {
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
