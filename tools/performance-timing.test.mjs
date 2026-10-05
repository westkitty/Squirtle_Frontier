import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertCompatibleDependencies,
  assertMatchedTiming,
  evaluateMatchedTiming,
} from "./performance-timing.mjs";

const budget = {
  toleranceMs: 8.4,
  confirmationWindows: 2,
  scenarios: {
    high: { medianMs: 33.4, p95Ms: 50.1 },
    channelCut: { medianMs: 33.4, p95Ms: 50.1 },
    channelDistant: { medianMs: 16.8, p95Ms: 33.4 },
    squirtles: { medianMs: 16.8, p95Ms: 33.4 },
  },
};

function sample(medianMs, p95Ms, windows = [[medianMs, p95Ms], [medianMs, p95Ms]]) {
  return {
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

function run(baseline, candidate) {
  return evaluateMatchedTiming({
    baseline,
    candidate,
    budget,
    baselineRevision: "base",
    candidateRevision: "head",
  });
}

test("equal matched measurements pass", () => {
  assert.equal(run(evidence(), evidence()).verdict, "PASS");
});

test("small matched variation inside tolerance passes", () => {
  assert.equal(run(evidence(), evidence(41.7, 58.4)).verdict, "PASS");
});

test("one bad confirmation window is noise, not a sustained regression", () => {
  const candidateHigh = sample(50.1, 66.8, [[50.1, 66.8], [33.4, 50.1]]);
  const candidate = evidence(33.4, 50.1, {
    scenarios: [{ quality: "high", ...candidateHigh }],
  });
  const result = run(evidence(), candidate);
  assert.equal(result.scenarios.high.verdict, "PASS");
  assert.equal(result.verdict, "PASS");
});

test("both confirmation windows beyond tolerance fail", () => {
  const candidateHigh = sample(50.1, 66.8);
  const candidate = evidence(33.4, 50.1, {
    scenarios: [{ quality: "high", ...candidateHigh }],
  });
  const result = run(evidence(), candidate);
  assert.equal(result.scenarios.high.sustainedMedian, true);
  assert.equal(result.verdict, "FAIL");
  assert.throws(
    () => assertMatchedTiming({ baseline: evidence(), candidate, budget }),
    /matched performance regression/,
  );
});

test("a sustained roughly one-frame p95 bucket regression fails", () => {
  const candidateHigh = sample(33.4, 66.8, [[33.4, 66.8], [33.4, 66.8]]);
  const candidate = evidence(33.4, 50.1, {
    scenarios: [{ quality: "high", ...candidateHigh }],
  });
  const result = run(evidence(), candidate);
  assert.equal(result.scenarios.high.sustainedP95, true);
  assert.equal(result.verdict, "FAIL");
});

test("runner-wide slowness is normalized by same-runner comparison", () => {
  const slowRunnerBaseline = evidence(83.3, 150);
  const slowRunnerCandidate = evidence(84.0, 151);
  const result = run(slowRunnerBaseline, slowRunnerCandidate);
  assert.equal(result.verdict, "PASS");
  assert.equal(result.scenarios.high.delta.medianMs, 0.7);
  assert.equal(result.scenarios.high.delta.p95Ms, 1);
});


test("independent window bucket order cannot fail an unchanged whole-run p95", () => {
  const baselineDistant = sample(66.6, 100.0, [[66.6, 66.7], [66.6, 100.0]]);
  const candidateDistant = sample(66.6, 100.1, [[50.1, 99.9], [66.6, 116.6]]);
  const baseline = evidence(33.4, 50.1, { channelDistant: baselineDistant });
  const candidate = evidence(33.4, 50.1, { channelDistant: candidateDistant });
  const result = run(baseline, candidate);
  assert.equal(result.scenarios.channelDistant.delta.p95Ms, 0.1);
  assert.equal(result.scenarios.channelDistant.verdict, "PASS");
  assert.equal(result.verdict, "PASS");
});

test("missing or malformed baseline windows fail explicitly", () => {
  const malformed = evidence();
  malformed.scenarios[0].windows = [{ medianMs: 33.4, p95Ms: 50.1 }];
  assert.throws(() => run(malformed, evidence()), /exactly 2 confirmation windows/);

  const missing = evidence();
  delete missing.channelCut;
  assert.throws(() => run(missing, evidence()), /missing scenario channelCut/);
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
