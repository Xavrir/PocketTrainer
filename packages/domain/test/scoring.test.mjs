import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateConsistency,
  calculateRangeRuleScore,
  calculateSessionScore,
  evaluateFormRule,
} from "../dist/index.js";

test("range scoring is transparent at ideal, tolerance, and hard boundaries", () => {
  const ideal = { minimum: 70, maximum: 110 };
  const hard = { minimum: 50, maximum: 130 };
  assert.equal(calculateRangeRuleScore(90, ideal, hard), 100);
  assert.equal(calculateRangeRuleScore(60, ideal, hard), 50);
  assert.equal(calculateRangeRuleScore(120, ideal, hard), 50);
  assert.equal(calculateRangeRuleScore(45, ideal, hard), 0);
  assert.equal(calculateRangeRuleScore(140, ideal, hard), 0);
});

test("rule evaluation derives critical pass status from the hard safety range", () => {
  const rule = {
    id: "knee-track",
    phases: ["bottom"],
    metric: "front_knee_ankle_offset",
    idealRange: { minimum: 0, maximum: 0.12 },
    hardRange: { minimum: 0, maximum: 0.25 },
    weight: 1,
    phaseWeight: 1,
    critical: true,
    feedbackKey: "knee",
  };
  assert.equal(evaluateFormRule(rule, 0.2).passed, true);
  assert.equal(evaluateFormRule(rule, 0.3).passed, false);
});

test("session score follows the 50/25/15/10 formula", () => {
  const score = calculateSessionScore({
    ruleScores: [
      { ruleId: "a", score: 80, weight: 0.6, phaseWeight: 1, critical: true, passed: true },
      { ruleId: "b", score: 100, weight: 0.4, phaseWeight: 1, critical: false, passed: true },
    ],
    completion: 90,
    control: 80,
    repetitionFormScores: [88, 88],
    confidenceEligible: true,
  });
  assert.deepEqual(score, {
    formAccuracy: 88,
    completion: 90,
    control: 80,
    consistency: 100,
    total: 88.5,
    criticalRulesPassed: true,
  });
});

test("low tracking confidence returns no score instead of a punitive score", () => {
  assert.equal(
    calculateSessionScore({
      ruleScores: [{ ruleId: "a", score: 100, weight: 1, phaseWeight: 1, critical: true, passed: true }],
      completion: 100,
      control: 100,
      repetitionFormScores: [100],
      confidenceEligible: false,
    }),
    null,
  );
});

test("a critical form-rule failure can never mark a high aggregate score progression-eligible", () => {
  const score = calculateSessionScore({
    ruleScores: [{
      ruleId: "critical",
      score: 80,
      weight: 1,
      phaseWeight: 1,
      critical: true,
      passed: false,
    }],
    completion: 100,
    control: 100,
    repetitionFormScores: [100, 100],
    confidenceEligible: true,
  });
  assert.ok(score.total >= 85);
  assert.equal(score.criticalRulesPassed, false);
});

test("consistency penalizes variance without penalizing a single valid rep", () => {
  assert.equal(calculateConsistency([80]), 100);
  assert.equal(calculateConsistency([80, 80, 80]), 100);
  assert.equal(calculateConsistency([0, 0]), 0);
  assert.ok(calculateConsistency([40, 100]) < 70);
});
