import type {
  Catalog,
  ExerciseDefinition,
  ExerciseResultInput,
  Lesson,
  Profile,
  Progress,
  SkillMastery,
} from './domain.types';

/**
 * These keys are the only movements for which the native engine can emit a
 * confidence-eligible form score. Keep this allowlist narrower than the
 * catalog so newly published or unknown movements fail closed.
 */
export const TRACKING_SUPPORTED_EXERCISE_KEYS = new Set([
  'body_squat',
  'incline_push_up',
  'warrior_ii',
  'tree_pose',
  'jumping_jack',
]);

/** @deprecated Use TRACKING_SUPPORTED_EXERCISE_KEYS for policy decisions. */
export const SCORED_EXERCISE_KEY = 'body_squat';

export function isTrackingSupportedExercise(exerciseKey: string): boolean {
  return TRACKING_SUPPORTED_EXERCISE_KEYS.has(exerciseKey);
}

export type CanonicalWorkout = {
  lesson: Lesson;
  exercise: ExerciseDefinition;
};

export type LessonAccessState =
  | 'available'
  | 'completed'
  | 'gated_equipment'
  | 'locked_prerequisite'
  | 'locked_mastery'
  | 'locked_level';

export type LessonAccessContext = {
  level: number;
  equipment: readonly string[];
  completedLessonIds: ReadonlySet<string>;
  mastery: readonly SkillMastery[];
};

export type ResultPolicyIssue = {
  code: 'WORKOUT_RESULT_DEFINITION_MISMATCH' | 'WORKOUT_RESULT_VERSION_MISMATCH' | 'WORKOUT_TRACKING_UNSUPPORTED';
  message: string;
};

export type WorkoutResultEvaluation = {
  averageForm: number | null;
  completionScore: number;
  masteryQualifies: boolean;
  progressionSuppressed: boolean;
  targetMet: boolean;
};

export function findCanonicalWorkout(catalog: Catalog, lessonId: string): CanonicalWorkout | null {
  const lesson = catalog.tracks
    .flatMap((track) => track.courses)
    .flatMap((course) => course.units)
    .flatMap((unit) => unit.lessons)
    .find((candidate) => candidate.id === lessonId);
  if (!lesson) return null;

  const exercise = catalog.exercises.find((candidate) => candidate.id === lesson.exerciseDefinitionId);
  return exercise ? { lesson, exercise } : null;
}

export function accessContext(progress: Progress, profile: Profile | null): LessonAccessContext {
  return {
    level: progress.xp.level,
    equipment: profile?.equipment ?? [],
    completedLessonIds: new Set(progress.completedLessonIds),
    mastery: progress.mastery,
  };
}

export function evaluateLessonAccess(lesson: Lesson, context: LessonAccessContext): LessonAccessState {
  if (lesson.requirements.requiredEquipment.some((equipment) => !context.equipment.includes(equipment))) {
    return 'gated_equipment';
  }
  if (lesson.requirements.prerequisiteLessonIds.some((id) => !context.completedLessonIds.has(id))) {
    return 'locked_prerequisite';
  }
  if (lesson.requirements.requiredMasteryKeys.some((key) => !hasRequiredMastery(context.mastery, key))) {
    return 'locked_mastery';
  }
  if (context.level < lesson.requirements.minimumLevel) return 'locked_level';
  return context.completedLessonIds.has(lesson.id) ? 'completed' : 'available';
}

export function isLessonLaunchable(state: LessonAccessState): boolean {
  return state === 'available' || state === 'completed';
}

export function launchableLessonIds(catalog: Catalog, context: LessonAccessContext): Set<string> {
  const ids = new Set<string>();
  for (const track of catalog.tracks) {
    for (const course of track.courses) {
      for (const unit of course.units) {
        for (const lesson of unit.lessons) {
          if (isLessonLaunchable(evaluateLessonAccess(lesson, context))) ids.add(lesson.id);
        }
      }
    }
  }
  return ids;
}

export function validateWorkoutResults(canonical: CanonicalWorkout, results: readonly ExerciseResultInput[]): ResultPolicyIssue | null {
  for (const result of results) {
    if (result.exerciseDefinitionId !== canonical.exercise.id) {
      return {
        code: 'WORKOUT_RESULT_DEFINITION_MISMATCH',
        message: 'Exercise results must use the workout lesson definition.',
      };
    }
    if (
      result.exerciseDefinitionVersion !== canonical.exercise.version
      || result.scoringVersion !== canonical.exercise.scoringVersion
      || result.poseModelVersion !== canonical.exercise.poseModelVersion
    ) {
      return {
        code: 'WORKOUT_RESULT_VERSION_MISMATCH',
        message: 'Exercise results must use the workout lesson definition versions.',
      };
    }
    if (
      !isTrackingSupportedExercise(canonical.exercise.exerciseKey)
      && (result.trackingEligible || result.formScore !== undefined)
    ) {
      return {
        code: 'WORKOUT_TRACKING_UNSUPPORTED',
        message: 'Tracking eligibility and form scores are not supported for this movement.',
      };
    }
  }
  return null;
}

export function canonicalizeWorkoutResults(
  canonical: CanonicalWorkout,
  results: readonly ExerciseResultInput[],
): ExerciseResultInput[] {
  return results.map((result) => ({
    ...result,
    completionScore: completionPercent(measuredResultValue(canonical.lesson, result), canonical.lesson.target.value),
  }));
}

export function evaluateWorkoutResults(
  canonical: CanonicalWorkout,
  results: readonly ExerciseResultInput[],
  input: { painReported: boolean; perceivedDifficulty: number },
): WorkoutResultEvaluation {
  const measuredValue = results.reduce((total, result) => total + measuredResultValue(canonical.lesson, result), 0);
  const completionScore = completionPercent(measuredValue, canonical.lesson.target.value);
  const targetMet = measuredValue >= canonical.lesson.target.value;
  const trackingEligible = isTrackingSupportedExercise(canonical.exercise.exerciseKey)
    && results.every((result) => result.trackingEligible && result.formScore !== undefined);
  const averageForm = trackingEligible ? weightedAverageForm(results) : null;
  const progressionSuppressed = input.painReported || !trackingEligible || !targetMet || averageForm === null;

  return {
    averageForm,
    completionScore,
    targetMet,
    progressionSuppressed,
    masteryQualifies: !progressionSuppressed
      && averageForm >= 85
      && input.perceivedDifficulty <= 6,
  };
}

function hasRequiredMastery(mastery: readonly SkillMastery[], exerciseKey: string): boolean {
  return mastery.some((item) => item.exerciseKey === exerciseKey && item.mastered && !item.restricted);
}

function measuredResultValue(lesson: Lesson, result: ExerciseResultInput): number {
  return lesson.target.type === 'reps' ? result.validReps : result.durationMs / 1_000;
}

function completionPercent(value: number, target: number): number {
  return Math.round(Math.min(100, (value / target) * 100) * 100) / 100;
}

function weightedAverageForm(results: readonly ExerciseResultInput[]): number {
  const weighted = results.reduce(
    (totals, result) => {
      const weight = Math.max(result.validReps, 1);
      return {
        score: totals.score + result.formScore! * weight,
        weight: totals.weight + weight,
      };
    },
    { score: 0, weight: 0 },
  );
  return weighted.score / weighted.weight;
}
