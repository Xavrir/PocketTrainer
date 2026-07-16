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
  masteryScores: Readonly<Record<string, number | undefined>>;
  availableEquipment: ReadonlySet<Equipment>;
  capabilityScores: Readonly<Partial<Record<AssessmentCapability, number>>>;
  activeRestrictions: ReadonlySet<RestrictionTag>;
}>;

export function evaluateLessonUnlock(
  lesson: Lesson,
  context: LessonUnlockContext,
): LessonUnlockDecision {
  const reasons: LessonUnlockDecision["reasons"][number][] = [];
  if (lesson.publishingState !== "published") {
    reasons.push({ code: "CONTENT_NOT_PUBLISHED" });
  }
  if (context.accountLevel < lesson.requirements.minimumAccountLevel) {
    reasons.push({
      code: "ACCOUNT_LEVEL_REQUIRED",
      currentValue: context.accountLevel,
      requiredValue: lesson.requirements.minimumAccountLevel,
    });
  }
  for (const prerequisiteId of lesson.requirements.prerequisiteLessonIds) {
    if (!context.completedLessonIds.has(prerequisiteId)) {
      reasons.push({ code: "PREREQUISITE_LESSON_REQUIRED", reference: prerequisiteId });
    }
  }
  for (const requirement of lesson.requirements.mastery) {
    const score = context.masteryScores[requirement.exerciseKey] ?? 0;
    if (score < requirement.minimumMasteryScore) {
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
  if (
    context.completedLessonIds.has(lesson.id) &&
    !reasons.some(
      (reason) =>
        reason.code === "ACTIVE_RESTRICTION" || reason.code === "CONTENT_NOT_PUBLISHED",
    )
  ) {
    return Object.freeze({ state: "completed", reasons: Object.freeze([]) });
  }
  return Object.freeze({
    state: accessStateFor(reasons.map((reason) => reason.code)),
    reasons: Object.freeze(reasons),
  });
}

function accessStateFor(reasons: readonly LessonLockReason[]): LessonUnlockDecision["state"] {
  if (reasons.length === 0) {
    return "available";
  }
  return reasons.includes("CONTENT_NOT_PUBLISHED") || reasons.includes("ACTIVE_RESTRICTION")
    ? "locked"
    : "gated";
}
