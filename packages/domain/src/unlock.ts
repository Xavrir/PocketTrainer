import type {
  AssessmentCapability,
  Equipment,
  Lesson,
  LessonLockReason,
  LessonUnlockDecision,
  RestrictionTag,
  Uuid,
} from "@pockettrainer/contracts";

export type LessonUnlockContext = Readonly<{
  accountLevel: number;
  completedLessonIds: ReadonlySet<Uuid>;
  mastery: Readonly<
    Record<string, Readonly<{ score: number; mastered: boolean }> | undefined>
  >;
  availableEquipment: ReadonlySet<Equipment>;
  capabilityScores: Readonly<Partial<Record<AssessmentCapability, number>>>;
  activeRestrictions: ReadonlySet<RestrictionTag>;
  courseMinimumAccountLevel: number;
  coursePublishingState: "draft" | "review" | "published" | "retired";
}>;

export function evaluateLessonUnlock(
  lesson: Lesson,
  context: LessonUnlockContext,
): LessonUnlockDecision {
  assertNonNegativeInteger(context.accountLevel, "accountLevel");
  assertNonNegativeInteger(context.courseMinimumAccountLevel, "courseMinimumAccountLevel");
  assertNonNegativeInteger(lesson.requirements.minimumAccountLevel, "minimumAccountLevel");
  const reasons: LessonUnlockDecision["reasons"][number][] = [];
  if (lesson.publishingState !== "published" || context.coursePublishingState !== "published") {
    reasons.push({ code: "CONTENT_NOT_PUBLISHED" });
  }
  const requiredAccountLevel = Math.max(
    lesson.requirements.minimumAccountLevel,
    context.courseMinimumAccountLevel,
  );
  if (context.accountLevel < requiredAccountLevel) {
    reasons.push({
      code: "ACCOUNT_LEVEL_REQUIRED",
      currentValue: context.accountLevel,
      requiredValue: requiredAccountLevel,
    });
  }
  for (const prerequisiteId of lesson.requirements.prerequisiteLessonIds) {
    if (!context.completedLessonIds.has(prerequisiteId)) {
      reasons.push({ code: "PREREQUISITE_LESSON_REQUIRED", reference: prerequisiteId });
    }
  }
  for (const requirement of lesson.requirements.mastery) {
    const mastery = context.mastery[requirement.exerciseKey];
    const score = mastery?.score ?? 0;
    assertPercent(score, `mastery score for ${requirement.exerciseKey}`);
    assertPercent(requirement.minimumMasteryScore, `mastery requirement for ${requirement.exerciseKey}`);
    if (mastery?.mastered !== true || score < requirement.minimumMasteryScore) {
      reasons.push({
        code: "MASTERY_REQUIRED",
        reference: requirement.exerciseKey,
        currentValue: score,
        requiredValue: requirement.minimumMasteryScore,
      });
    }
  }
  for (const equipment of lesson.requirements.equipment) {
    if (equipment !== "none" && !context.availableEquipment.has(equipment)) {
      reasons.push({ code: "EQUIPMENT_REQUIRED", reference: equipment });
    }
  }
  for (const requirement of lesson.requirements.capabilities) {
    const score = context.capabilityScores[requirement.capability] ?? 0;
    assertPercent(score, `capability score for ${requirement.capability}`);
    assertPercent(requirement.minimumScore, `capability requirement for ${requirement.capability}`);
    if (score < requirement.minimumScore) {
      reasons.push({
        code: "ASSESSMENT_CAPABILITY_REQUIRED",
        reference: requirement.capability,
        currentValue: score,
        requiredValue: requirement.minimumScore,
      });
    }
  }
  for (const restriction of lesson.requirements.blockedByRestrictionTags) {
    if (context.activeRestrictions.has(restriction)) {
      reasons.push({ code: "ACTIVE_RESTRICTION", reference: restriction });
    }
  }
  const completed = context.completedLessonIds.has(lesson.id);
  return Object.freeze({
    state: completed ? "completed" : accessStateFor(reasons.map((reason) => reason.code)),
    launchAllowed: reasons.length === 0,
    reasons: Object.freeze(reasons),
  });
}

function assertPercent(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError(`${name} must be between 0 and 100`);
  }
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

function accessStateFor(reasons: readonly LessonLockReason[]): LessonUnlockDecision["state"] {
  if (reasons.length === 0) {
    return "available";
  }
  return reasons.includes("CONTENT_NOT_PUBLISHED") || reasons.includes("ACTIVE_RESTRICTION")
    ? "locked"
    : "gated";
}
