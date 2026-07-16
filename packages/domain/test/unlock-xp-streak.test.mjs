import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateXpAward,
  evaluateLessonUnlock,
  evaluateMastery,
  evaluateStreakDay,
} from "../dist/index.js";

const lesson = {
  id: "lesson-2",
  key: "squat-control",
  title: { "id-ID": "Kontrol squat", "en-US": "Squat control" },
  description: { "id-ID": "", "en-US": "" },
  order: 2,
  estimatedMinutes: 8,
  baseXp: 20,
  publishingState: "published",
  requirements: {
    minimumAccountLevel: 3,
    prerequisiteLessonIds: ["lesson-1"],
    mastery: [{ exerciseKey: "body_squat", minimumMasteryScore: 85 }],
    equipment: ["none"],
    capabilities: [{ capability: "lower_body_control", minimumScore: 40 }],
    blockedByRestrictionTags: ["knee_flexion"],
  },
  exercises: [
    {
      exerciseKey: "body_squat",
      exerciseDefinitionVersion: 1,
      order: 1,
      targetRepetitions: 8,
      sets: 1,
      restAfterMs: 30_000,
    },
  ],
};

const unlockContext = {
  accountLevel: 3,
  completedLessonIds: new Set(["lesson-1"]),
  mastery: { body_squat: { score: 90, mastered: true } },
  availableEquipment: new Set(["none"]),
  capabilityScores: { lower_body_control: 50 },
  activeRestrictions: new Set(),
  courseMinimumAccountLevel: 1,
  coursePublishingState: "published",
};

test("harder lessons require level, prerequisite, mastery, and capability", () => {
  assert.equal(evaluateLessonUnlock(lesson, unlockContext).state, "available");
  assert.equal(evaluateLessonUnlock(lesson, unlockContext).launchAllowed, true);
  const gated = evaluateLessonUnlock(lesson, {
    ...unlockContext,
    accountLevel: 2,
    mastery: { body_squat: { score: 60, mastered: false } },
  });
  assert.equal(gated.state, "gated");
  assert.deepEqual(
    gated.reasons.map((reason) => reason.code),
    ["ACCOUNT_LEVEL_REQUIRED", "MASTERY_REQUIRED"],
  );

  const oneHighSessionIsNotMastery = evaluateLessonUnlock(lesson, {
    ...unlockContext,
    mastery: { body_squat: { score: 95, mastered: false } },
  });
  assert.equal(oneHighSessionIsNotMastery.launchAllowed, false);
  assert.deepEqual(oneHighSessionIsNotMastery.reasons.map((reason) => reason.code), ["MASTERY_REQUIRED"]);
});

test("an active restriction locks content even when XP and mastery pass", () => {
  const locked = evaluateLessonUnlock(lesson, {
    ...unlockContext,
    activeRestrictions: new Set(["knee_flexion"]),
  });
  assert.equal(locked.state, "locked");
  assert.deepEqual(locked.reasons.map((reason) => reason.code), ["ACTIVE_RESTRICTION"]);

  const completedButUnsafe = evaluateLessonUnlock(lesson, {
    ...unlockContext,
    completedLessonIds: new Set(["lesson-1", "lesson-2"]),
    activeRestrictions: new Set(["knee_flexion"]),
  });
  assert.equal(completedButUnsafe.state, "completed");
  assert.equal(completedButUnsafe.launchAllowed, false);

  const completedAfterRegression = evaluateLessonUnlock(lesson, {
    ...unlockContext,
    completedLessonIds: new Set(["lesson-1", "lesson-2"]),
    mastery: { body_squat: { score: 40, mastered: false } },
  });
  assert.equal(completedAfterRegression.state, "completed");
  assert.equal(completedAfterRegression.launchAllowed, false);
  assert.deepEqual(completedAfterRegression.reasons.map((reason) => reason.code), ["MASTERY_REQUIRED"]);
});

test("course publication and level gates apply before a lesson can launch", () => {
  const courseGated = evaluateLessonUnlock(lesson, {
    ...unlockContext,
    courseMinimumAccountLevel: 5,
    coursePublishingState: "review",
  });
  assert.equal(courseGated.state, "locked");
  assert.equal(courseGated.launchAllowed, false);
  assert.deepEqual(
    courseGated.reasons.map((reason) => reason.code),
    ["CONTENT_NOT_PUBLISHED", "ACCOUNT_LEVEL_REQUIRED"],
  );
  assert.throws(() => evaluateLessonUnlock(lesson, { ...unlockContext, accountLevel: Number.NaN }), RangeError);
});

test("a critical-rule regression cannot leak a high aggregate score into an unlock", () => {
  const mastery = evaluateMastery([{
    workoutSessionId: "unsafe-session",
    completedAt: "2026-07-16T10:00:00.000Z",
    formScore: 98,
    completionPercent: 100,
    perceivedDifficulty: 3,
    validRepetitionRate: 1,
    confidenceEligible: true,
    criticalRulesPassed: false,
    painReported: false,
  }]);
  assert.equal(mastery.masteryScore, 0);
  const access = evaluateLessonUnlock(lesson, {
    ...unlockContext,
    mastery: {
      body_squat: {
        score: mastery.masteryScore,
        mastered: mastery.progressionCriteriaMet,
      },
    },
  });
  assert.equal(access.launchAllowed, false);
  assert.deepEqual(access.reasons.map((reason) => reason.code), ["MASTERY_REQUIRED"]);
});

test("XP awards are idempotent and capped per local day", () => {
  const candidate = {
    eventType: "WORKOUT_COMPLETED",
    eventId: "session-1",
    requestedPoints: 50,
    idempotencyKey: "WORKOUT_COMPLETED:session-1",
  };
  assert.deepEqual(
    calculateXpAward(candidate, {
      dailyCappedPoints: 80,
      dailyExerciseXpCap: 100,
      processedAwards: new Map(),
    }),
    {
      awardedPoints: 20,
      cappedPoints: 30,
      duplicate: false,
      dailyCappedTotalAfterAward: 100,
    },
  );
  assert.deepEqual(
    calculateXpAward(candidate, {
      dailyCappedPoints: 80,
      dailyExerciseXpCap: 100,
      processedAwards: new Map([[candidate.idempotencyKey, {
        candidate,
        decision: {
          awardedPoints: 20,
          cappedPoints: 30,
          dailyCappedTotalAfterAward: 100,
        },
      }]]),
    }),
    {
      awardedPoints: 20,
      cappedPoints: 30,
      duplicate: true,
      dailyCappedTotalAfterAward: 100,
    },
  );

  const weeklyBonus = calculateXpAward(
    { ...candidate, eventType: "WEEKLY_GOAL_COMPLETED", requestedPoints: 30, idempotencyKey: "WEEKLY:1" },
    {
      dailyCappedPoints: 100,
      dailyExerciseXpCap: 100,
      processedAwards: new Map(),
    },
  );
  assert.equal(weeklyBonus.awardedPoints, 30);
  assert.equal(weeklyBonus.dailyCappedTotalAfterAward, 100);

  assert.throws(() => calculateXpAward(
    { ...candidate, requestedPoints: 999 },
    {
      dailyCappedPoints: 80,
      dailyExerciseXpCap: 100,
      processedAwards: new Map([[candidate.idempotencyKey, {
        candidate,
        decision: { awardedPoints: 20, cappedPoints: 30, dailyCappedTotalAfterAward: 100 },
      }]]),
    },
  ));
});

test("scheduled recovery protects a streak without requiring unsafe volume", () => {
  assert.equal(
    evaluateStreakDay({ dayType: "RECOVERY", scheduled: true, qualifyingActivityCompleted: false }),
    "PROTECTED",
  );
  assert.equal(
    evaluateStreakDay({ dayType: "WORKOUT", scheduled: true, qualifyingActivityCompleted: false }),
    "MISSED",
  );
});
