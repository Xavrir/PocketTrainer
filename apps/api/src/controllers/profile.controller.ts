import { Body, Controller, Get, Headers, HttpStatus, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiError } from '../common/api-error';
import { CurrentUser } from '../common/current-user.decorator';
import { sendIdempotent } from '../common/idempotency';
import type { AuthenticatedUser } from '../common/request-context';
import { parseBody, requireIdempotencyKey } from '../common/zod';
import { profileSchema } from '../domain/domain.schemas';
import { PocketTrainerRepository } from '../repositories/pocket-trainer.repository';

@Controller('v1/profile')
export class ProfileController {
  constructor(private readonly repository: PocketTrainerRepository) {}
  @Get() async get(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.repository.getProfile(user.id);
    if (!profile) throw new ApiError('PROFILE_NOT_FOUND', 'Complete onboarding to create a profile.', HttpStatus.NOT_FOUND, true);
    return profile;
  }
  @Put() async put(@CurrentUser() user: AuthenticatedUser, @Headers('idempotency-key') rawKey: string | undefined, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    return sendIdempotent(response, await this.repository.updateProfile(user.id, requireIdempotencyKey(rawKey), parseBody(profileSchema, body)));
  }
}
