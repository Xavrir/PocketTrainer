import type {
  AssessmentCapability,
  Equipment,
  IsoDateTime,
  LocalizedText,
  RestrictionTag,
  Uuid,
} from "./common.js";

export type PublishingState = "draft" | "review" | "published" | "retired";
export type TrackKey = "strength" | "yoga" | "mobility";

export type MasteryRequirement = Readonly<{
  exerciseKey: string;
  minimumMasteryScore: number;
}>;

export type CapabilityRequirement = Readonly<{
  capability: AssessmentCapability;
  minimumScore: number;
}>;

export type LessonRequirements = Readonly<{
  minimumAccountLevel: number;
  prerequisiteLessonIds: readonly Uuid[];
  mastery: readonly MasteryRequirement[];
  equipment: readonly Equipment[];
  capabilities: readonly CapabilityRequirement[];
  blockedByRestrictionTags: readonly RestrictionTag[];
}>;

export type LessonExercise = Readonly<{
  exerciseKey: string;
  exerciseDefinitionVersion: number;
  order: number;
  targetRepetitions?: number;
  targetHoldDurationMs?: number;
  sets: number;
  restAfterMs: number;
}>;

export type Lesson = Readonly<{
  id: Uuid;
  key: string;
  title: LocalizedText;
  description: LocalizedText;
  order: number;
  estimatedMinutes: number;
  baseXp: number;
  publishingState: PublishingState;
  requirements: LessonRequirements;
  exercises: readonly LessonExercise[];
}>;

export type Unit = Readonly<{
  id: Uuid;
  key: string;
  title: LocalizedText;
  description: LocalizedText;
  order: number;
  lessons: readonly Lesson[];
}>;

export type Course = Readonly<{
  id: Uuid;
  key: string;
  trackKey: TrackKey;
  title: LocalizedText;
  description: LocalizedText;
  order: number;
  minimumAccountLevel: number;
  publishingState: PublishingState;
  units: readonly Unit[];
}>;

export type Track = Readonly<{
  id: Uuid;
  key: TrackKey;
  title: LocalizedText;
  description: LocalizedText;
  order: number;
  courses: readonly Course[];
}>;

export type CourseCatalog = Readonly<{
  catalogVersion: string;
  schemaVersion: number;
  publishedAt: IsoDateTime;
  tracks: readonly Track[];
}>;

export type LessonAccessState = "completed" | "available" | "gated" | "locked";

export type LessonLockReason =
  | "ACCOUNT_LEVEL_REQUIRED"
  | "PREREQUISITE_LESSON_REQUIRED"
  | "MASTERY_REQUIRED"
  | "EQUIPMENT_REQUIRED"
  | "ASSESSMENT_CAPABILITY_REQUIRED"
  | "ACTIVE_RESTRICTION"
  | "CONTENT_NOT_PUBLISHED";

export type LessonUnlockDecision = Readonly<{
  state: LessonAccessState;
  launchAllowed: boolean;
  reasons: readonly Readonly<{
    code: LessonLockReason;
    reference?: string;
    currentValue?: number;
    requiredValue?: number;
  }>[];
}>;
