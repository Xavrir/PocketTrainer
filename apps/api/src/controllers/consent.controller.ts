import { Body, Controller, Get, Headers, Inject, Param, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/current-user.decorator';
import { sendIdempotent } from '../common/idempotency';
import type { AuthenticatedUser } from '../common/request-context';
import { parseBody, requireIdempotencyKey } from '../common/zod';
import { consentSchema, consentTypeSchema } from '../domain/domain.schemas';
import { PocketTrainerRepository } from '../repositories/pocket-trainer.repository';

@Controller('v1/consents')
export class ConsentController {
  constructor(@Inject(PocketTrainerRepository) private readonly repository: PocketTrainerRepository) {}
  @Get() get(@CurrentUser() user: AuthenticatedUser) { return this.repository.getConsents(user.id); }
  @Put(':type') async put(@CurrentUser() user: AuthenticatedUser, @Param('type') rawType: string, @Headers('idempotency-key') rawKey: string | undefined, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const type = parseBody(consentTypeSchema, rawType);
    return sendIdempotent(response, await this.repository.updateConsent(user.id, type, requireIdempotencyKey(rawKey), parseBody(consentSchema, body)));
  }
}
