import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config';
import { PocketTrainerRepository } from '../repositories/pocket-trainer.repository';

@Injectable()
export class OutboxProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PocketTrainerRepository) private readonly repository: PocketTrainerRepository,
  ) {}

  onModuleInit(): void {
    if (this.config.DATA_STORE !== 'postgres' || this.config.OUTBOX_POLL_MS === 0) return;
    this.timer = setInterval(() => void this.tick(), this.config.OUTBOX_POLL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const count = await this.repository.processOutboxBatch();
      if (count > 0) this.logger.log({ message: 'Processed transactional outbox events.', count });
    } catch (error) {
      this.logger.error({ message: 'Transactional outbox polling failed.', error });
    } finally { this.running = false; }
  }
}
