import { Body, Controller, Headers, Param, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/current-user.decorator';
import { sendIdempotent } from '../common/idempotency';
import type { AuthenticatedUser } from '../common/request-context';
import { parseBody, requireIdempotencyKey } from '../common/zod';
import { completeWorkoutSchema, createWorkoutSchema, workoutResultsSchema } from '../domain/domain.schemas';
import { PocketTrainerRepository } from '../repositories/pocket-trainer.repository';

@Controller('v1/workout-sessions')
export class WorkoutController {
  constructor(private readonly repository: PocketTrainerRepository) {}
  @Post() async create(@CurrentUser() user: AuthenticatedUser, @Headers('idempotency-key') rawKey: string | undefined, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    return sendIdempotent(response, await this.repository.createWorkout(user.id, requireIdempotencyKey(rawKey), parseBody(createWorkoutSchema, body)));
  }
  @Put(':id/results') async results(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('idempotency-key') rawKey: string | undefined, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    return sendIdempotent(response, await this.repository.saveWorkoutResults(user.id, id, requireIdempotencyKey(rawKey), parseBody(workoutResultsSchema, body).results));
  }
  @Post(':id/complete') async complete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('idempotency-key') rawKey: string | undefined, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    return sendIdempotent(response, await this.repository.completeWorkout(user.id, id, requireIdempotencyKey(rawKey), parseBody(completeWorkoutSchema, body)));
  }
}
