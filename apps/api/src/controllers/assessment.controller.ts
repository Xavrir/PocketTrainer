import { Body, Controller, Headers, Inject, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/current-user.decorator';
import { sendIdempotent } from '../common/idempotency';
import type { AuthenticatedUser } from '../common/request-context';
import { parseBody, requireIdempotencyKey } from '../common/zod';
import { assessmentCompletionInputSchema } from '../domain/domain.schemas';
import { PocketTrainerRepository } from '../repositories/pocket-trainer.repository';

@Controller('v1/assessments')
export class AssessmentController {
  constructor(@Inject(PocketTrainerRepository) private readonly repository: PocketTrainerRepository) {}
  @Post() async create(@CurrentUser() user: AuthenticatedUser, @Headers('idempotency-key') rawKey: string | undefined, @Res({ passthrough: true }) response: Response) {
    return sendIdempotent(response, await this.repository.createAssessment(user.id, requireIdempotencyKey(rawKey)));
  }
  @Post(':id/complete') async complete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('idempotency-key') rawKey: string | undefined, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    return sendIdempotent(response, await this.repository.completeAssessment(user.id, id, requireIdempotencyKey(rawKey), parseBody(assessmentCompletionInputSchema, body)));
  }
}
