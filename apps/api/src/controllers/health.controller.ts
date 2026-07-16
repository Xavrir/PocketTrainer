import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { PocketTrainerRepository } from '../repositories/pocket-trainer.repository';

@Controller('health')
export class HealthController {
  constructor(@Inject(PocketTrainerRepository) private readonly repository: PocketTrainerRepository) {}
  @Public()
  @Get()
  getHealth() { return { status: 'ok', service: 'pockettrainer-api', time: new Date().toISOString() }; }

  @Public()
  @Get('ready')
  async getReady() {
    if (!(await this.repository.ping())) throw new ServiceUnavailableException('Data store is unavailable.');
    return { status: 'ready', service: 'pockettrainer-api', time: new Date().toISOString() };
  }
}
