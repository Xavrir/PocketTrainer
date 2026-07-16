import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/request-context';
import { PocketTrainerRepository } from '../repositories/pocket-trainer.repository';

@Controller('v1/progress')
export class ProgressController {
  constructor(private readonly repository: PocketTrainerRepository) {}
  @Get() get(@CurrentUser() user: AuthenticatedUser) { return this.repository.getProgress(user.id); }
}
