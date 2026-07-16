import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/request-context';
import { PocketTrainerRepository } from '../repositories/pocket-trainer.repository';

@Controller('v1')
export class BootstrapController {
  constructor(private readonly repository: PocketTrainerRepository) {}
  @Get('bootstrap') getBootstrap(@CurrentUser() user: AuthenticatedUser) { return this.repository.getBootstrap(user.id); }
}
