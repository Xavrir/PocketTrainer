import { Controller, Delete, Get, Headers, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/current-user.decorator';
import { sendIdempotent } from '../common/idempotency';
import type { AuthenticatedUser } from '../common/request-context';
import { requireIdempotencyKey } from '../common/zod';
import { PocketTrainerRepository } from '../repositories/pocket-trainer.repository';

@Controller('v1/privacy')
export class PrivacyController {
  constructor(@Inject(PocketTrainerRepository) private readonly repository: PocketTrainerRepository) {}

  @Get('export')
  getExport(@CurrentUser() user: AuthenticatedUser) {
    return this.repository.getPrivacyExport(user.id);
  }

  @Delete('account')
  deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') rawKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.repository.deleteAccount(user.id, requireIdempotencyKey(rawKey)).then((result) => sendIdempotent(response, result));
  }
}
