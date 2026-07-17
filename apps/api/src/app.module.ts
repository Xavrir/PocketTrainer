import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard';
import { SupabaseTokenVerifier } from './auth/supabase-token.verifier';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { APP_CONFIG, loadConfig, type AppConfig } from './config';
import { AssessmentController } from './controllers/assessment.controller';
import { BootstrapController } from './controllers/bootstrap.controller';
import { CatalogController } from './controllers/catalog.controller';
import { ConsentController } from './controllers/consent.controller';
import { HealthController } from './controllers/health.controller';
import { PlanController } from './controllers/plan.controller';
import { ProfileController } from './controllers/profile.controller';
import { ProgressController } from './controllers/progress.controller';
import { PrivacyController } from './controllers/privacy.controller';
import { SyncController } from './controllers/sync.controller';
import { WorkoutController } from './controllers/workout.controller';
import { NutritionModule } from './nutrition/nutrition.module';
import { OutboxProcessorService } from './outbox/outbox-processor.service';
import { InMemoryPocketTrainerRepository } from './repositories/in-memory.repository';
import { PocketTrainerRepository } from './repositories/pocket-trainer.repository';
import { PostgresPocketTrainerRepository } from './repositories/postgres.repository';

@Module({
  controllers: [HealthController, BootstrapController, ProfileController, ConsentController, CatalogController, ProgressController, PrivacyController, AssessmentController, PlanController, WorkoutController, SyncController],
  providers: [
    { provide: APP_CONFIG, useFactory: loadConfig },
    SupabaseTokenVerifier,
    OutboxProcessorService,
    {
      provide: PocketTrainerRepository,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => config.DATA_STORE === 'postgres'
        ? new PostgresPocketTrainerRepository(config)
        : new InMemoryPocketTrainerRepository(config),
    },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  imports: [NutritionModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void { consumer.apply(RequestIdMiddleware).forRoutes('*'); }
}
