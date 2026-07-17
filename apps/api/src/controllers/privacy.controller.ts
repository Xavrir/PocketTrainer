import { Controller, Delete, Get, Headers, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/current-user.decorator';
import { sendIdempotent } from '../common/idempotency';
import type { AuthenticatedUser } from '../common/request-context';
import { requireIdempotencyKey } from '../common/zod';
import { NutritionService } from '../nutrition/nutrition.service';
import { PocketTrainerRepository } from '../repositories/pocket-trainer.repository';

@Controller('v1/privacy')
export class PrivacyController {
  constructor(
    @Inject(PocketTrainerRepository) private readonly repository: PocketTrainerRepository,
    @Inject(NutritionService) private readonly nutrition: NutritionService,
  ) {}

  @Get('export')
  async getExport(@CurrentUser() user: AuthenticatedUser) {
    const [base, nutrition] = await Promise.all([
      this.repository.getPrivacyExport(user.id),
      this.nutrition.getPrivacyExport(user.id),
    ]);
    return {
      ...base,
      nutrition,
      manifest: { ...base.manifest, includes: [...base.manifest.includes, 'nutrition'] },
    };
  }

  @Delete('account')
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') rawKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.repository.deleteAccount(user.id, requireIdempotencyKey(rawKey));
    await this.nutrition.deleteUserData(user.id);
    return sendIdempotent(response, result);
  }
}
