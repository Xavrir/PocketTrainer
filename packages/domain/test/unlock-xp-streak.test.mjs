import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateXpAward,
  evaluateLessonUnlock,
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
  masteryScores: { body_squat: 90 },
  availableEquipment: new Set(["none"]),
  capabilityScores: { lower_body_control: 50 },
  activeRestrictions: new Set(),
};

test("harder lessons require level, prerequisite, mastery, and capability", () => {
  assert.equal(evaluateLessonUnlock(lesson, unlockContext).state, "available");
  const gated = evaluateLessonUnlock(lesson, {
    ...unlockContext,
    accountLevel: 2,
    masteryScores: { body_squat: 60 },
  });
  assert.equal(gated.state, "gated");
  assert.deepEqual(
    gated.reasons.map((reason) => reason.code),
    ["ACCOUNT_LEVEL_REQUIRED", "MASTERY_REQUIRED"],
  );
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
  assert.equal(completedButUnsafe.state, "locked");
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
      dailyAwardedPoints: 80,
      dailyExerciseXpCap: 100,
      processedAwards: new Map(),
    }),
    {
      awardedPoints: 20,
      cappedPoints: 30,
      duplicate: false,
      dailyTotalAfterAward: 100,
    },
  );
  assert.deepEqual(
    calculateXpAward(candidate, {
      dailyAwardedPoints: 80,
      dailyExerciseXpCap: 100,
      processedAwards: new Map([[candidate.idempotencyKey, 20]]),
    }),
    {
      awardedPoints: 20,
      cappedPoints: 30,
      duplicate: true,
      dailyTotalAfterAward: 80,
    },
  );
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
