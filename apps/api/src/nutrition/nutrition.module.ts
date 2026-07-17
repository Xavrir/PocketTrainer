import { Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig, type AppConfig } from '../config';
import { NutritionController } from './nutrition.controller';
import { InMemoryNutritionRepository } from './in-memory-nutrition.repository';
import { NutritionRepository } from './nutrition.repository';
import { PackagedFoodService } from './packaged-food.service';
import { PostgresNutritionRepository } from './postgres-nutrition.repository';
import { NutritionService } from './nutrition.service';
import { GeminiNutritionService } from './gemini-nutrition.service';

@Module({
  controllers: [NutritionController],
  providers: [
    { provide: APP_CONFIG, useFactory: loadConfig },
    NutritionService,
    GeminiNutritionService,
    PackagedFoodService,
    InMemoryNutritionRepository,
    PostgresNutritionRepository,
    { provide: NutritionRepository, inject: [APP_CONFIG], useFactory: (config: AppConfig) => config.DATA_STORE === 'postgres' ? new PostgresNutritionRepository() : new InMemoryNutritionRepository() },
  ],
  exports: [NutritionService],
})
export class NutritionModule {}
