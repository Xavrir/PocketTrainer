import { Body, Controller, Headers, Inject, Post } from '@nestjs/common';
import { z } from 'zod';
import { ApiError } from '../common/api-error';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/request-context';
import { parseBody, requireIdempotencyKey } from '../common/zod';
import {
  assessmentResultSchema,
  completeWorkoutSchema,
  consentSchema,
  consentTypeSchema,
  createWorkoutSchema,
  profileSchema,
  workoutResultsSchema,
} from '../domain/domain.schemas';
import { PocketTrainerRepository } from '../repositories/pocket-trainer.repository';

const base = { idempotencyKey: z.string().trim().min(1).max(200) };
const syncEventSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('profile.update'), payload: profileSchema }).strict(),
  z.object({ ...base, type: z.literal('consent.update'), payload: z.object({ consentType: consentTypeSchema, ...consentSchema.shape }).strict() }).strict(),
  z.object({ ...base, type: z.literal('assessment.create'), payload: z.object({}).strict() }).strict(),
  z.object({ ...base, type: z.literal('assessment.complete'), payload: z.object({ assessmentId: z.string().uuid(), result: assessmentResultSchema }).strict() }).strict(),
  z.object({ ...base, type: z.literal('workout.create'), payload: createWorkoutSchema }).strict(),
  z.object({ ...base, type: z.literal('workout.results'), payload: z.object({ sessionId: z.string().uuid(), ...workoutResultsSchema.shape }).strict() }).strict(),
  z.object({ ...base, type: z.literal('workout.complete'), payload: z.object({ sessionId: z.string().uuid(), ...completeWorkoutSchema.shape }).strict() }).strict(),
]);
const syncBatchSchema = z.object({ events: z.array(syncEventSchema).min(1).max(50) }).strict();

@Controller('v1/sync')
export class SyncController {
  constructor(@Inject(PocketTrainerRepository) private readonly repository: PocketTrainerRepository) {}

  @Post('batch')
  async batch(@CurrentUser() user: AuthenticatedUser, @Headers('idempotency-key') batchKey: string | undefined, @Body() body: unknown) {
    const batchId = requireIdempotencyKey(batchKey);
    const { events } = parseBody(syncBatchSchema, body);
    const results: unknown[] = [];
    for (const event of events) {
      try {
        const result = await this.dispatch(user.id, event);
        results.push({ idempotencyKey: event.idempotencyKey, status: result.replayed ? 'replayed' : 'applied', value: result.value });
      } catch (error) {
        const response = error instanceof ApiError ? error.getResponse() : undefined;
        results.push({ idempotencyKey: event.idempotencyKey, status: 'failed', error: typeof response === 'object' ? response : { code: 'INTERNAL_ERROR', message: 'The event could not be synchronized.', recoverable: true } });
      }
    }
    return { batchId, results };
  }

  private dispatch(userId: string, event: z.infer<typeof syncEventSchema>) {
    switch (event.type) {
      case 'profile.update': return this.repository.updateProfile(userId, event.idempotencyKey, event.payload);
      case 'consent.update': {
        const { consentType, granted, version } = event.payload;
        return this.repository.updateConsent(userId, consentType, event.idempotencyKey, { granted, version });
      }
      case 'assessment.create': return this.repository.createAssessment(userId, event.idempotencyKey);
      case 'assessment.complete': return this.repository.completeAssessment(userId, event.payload.assessmentId, event.idempotencyKey, event.payload.result);
      case 'workout.create': return this.repository.createWorkout(userId, event.idempotencyKey, event.payload);
      case 'workout.results': return this.repository.saveWorkoutResults(userId, event.payload.sessionId, event.idempotencyKey, event.payload.results);
      case 'workout.complete': {
        const { sessionId, ...input } = event.payload;
        return this.repository.completeWorkout(userId, sessionId, event.idempotencyKey, input);
      }
    }
  }
}
