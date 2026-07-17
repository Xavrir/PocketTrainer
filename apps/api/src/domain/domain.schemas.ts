import { z } from 'zod';

export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  locale: z.enum(['id', 'en']),
  timezone: z.string().min(1).max(100),
  primaryGoal: z.enum(['build_strength', 'improve_mobility', 'build_consistency', 'reduce_stress']),
  experienceLevel: z.enum(['foundation', 'beginner', 'intermediate']),
  equipment: z.array(z.string().min(1).max(80)).max(30),
  limitations: z.array(z.string().min(1).max(100)).max(30),
  schedule: z.object({ days: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).min(1).max(7), durationMinutes: z.number().int().min(10).max(120) }).strict(),
  onboardingCompleted: z.boolean(),
}).strict();

export const consentTypeSchema = z.enum(['privacy', 'camera_processing', 'fitness_guidance', 'analytics']);
export const consentSchema = z.object({ granted: z.boolean(), version: z.string().min(1).max(40) }).strict();

const score = z.number().min(0).max(100);
export const assessmentResultV1Schema = z.object({
  lowerBodyControl: score,
  upperBodyControl: score,
  balance: score,
  mobility: score,
  coreStability: score,
  recommendedLevel: z.enum(['foundation', 'beginner', 'intermediate']),
  trackingEligible: z.boolean(),
  restrictions: z.array(z.string().min(1).max(100)).max(30),
}).strict();

export const assessmentEvidenceV2Schema = z.object({
  squatSessionId: z.string().uuid(),
  targetReps: z.literal(3),
  validReps: z.number().int().min(0).max(3),
  durationMs: z.number().int().positive().max(600_000),
  confidenceEligible: z.boolean(),
  formScore: score.nullable(),
  painReported: z.boolean(),
}).strict().superRefine((value, context) => {
  const scoreAllowed = value.confidenceEligible && !value.painReported;
  if (scoreAllowed && value.formScore === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['formScore'], message: 'A form score is required for eligible, pain-free evidence.' });
  }
  if (!scoreAllowed && value.formScore !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['formScore'], message: 'A form score must be null when confidence is ineligible or pain is reported.' });
  }
});

export const assessmentCompletionInputSchema = z.union([assessmentEvidenceV2Schema, assessmentResultV1Schema]);
/** @deprecated Use assessmentCompletionInputSchema for assessment completion payloads. */
export const assessmentResultSchema = assessmentCompletionInputSchema;

export const createWorkoutSchema = z.object({
  lessonId: z.string().uuid(),
  startedAt: z.string().datetime({ offset: true }),
  deviceId: z.string().uuid().optional(),
  applicationVersion: z.string().min(1).max(40),
}).strict();

export const exerciseResultSchema = z.object({
  clientResultId: z.string().uuid(),
  exerciseDefinitionId: z.string().uuid(),
  exerciseDefinitionVersion: z.number().int().positive(),
  scoringVersion: z.string().min(1).max(40),
  poseModelVersion: z.string().min(1).max(80),
  setNumber: z.number().int().min(1).max(100),
  totalReps: z.number().int().min(0).max(1_000),
  validReps: z.number().int().min(0).max(1_000),
  formScore: score.optional(),
  completionScore: score,
  controlScore: score,
  consistencyScore: score,
  mainFeedbackCode: z.string().min(1).max(100).optional(),
  trackingEligible: z.boolean(),
  durationMs: z.number().int().min(0).max(7_200_000),
}).strict().superRefine((value, context) => {
  if (value.validReps > value.totalReps) context.addIssue({ code: z.ZodIssueCode.custom, path: ['validReps'], message: 'validReps cannot exceed totalReps.' });
  if (value.trackingEligible && value.formScore === undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ['formScore'], message: 'A form score is required when tracking is eligible.' });
  if (!value.trackingEligible && value.formScore !== undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ['formScore'], message: 'A form score cannot be supplied when tracking is ineligible.' });
});

export const workoutResultsSchema = z.object({ results: z.array(exerciseResultSchema).min(1).max(100) }).strict();
export const completeWorkoutSchema = z.object({ completedAt: z.string().datetime({ offset: true }), perceivedDifficulty: z.number().int().min(1).max(10), painReported: z.boolean() }).strict();
