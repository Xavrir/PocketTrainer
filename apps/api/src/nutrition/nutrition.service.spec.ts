import { HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../common/api-error';
import { NutritionService } from './nutrition.service';
import type { NutritionRepository } from './nutrition.repository';
import type { GeminiNutritionService } from './gemini-nutrition.service';
import type { PackagedFoodService } from './packaged-food.service';

const providerFood = {
  authoritative: true,
  barcode: '3017620422003',
  brand: 'Ferrero',
  name: 'Nutella',
  nutritionPerServing: {
    caloriesKcal: 80,
    proteinG: 0.9,
    carbohydrateG: 8.6,
    fatG: 4.6,
    fiberG: 0.4,
    sugarG: 8.4,
    sodiumMg: 6,
  },
  serving: { amount: 15, unit: 'g', label: '15 g' },
  source: 'open_food_facts' as const,
};

function createService(repository: Partial<NutritionRepository>) {
  const packagedFood = {
    lookup: vi.fn().mockResolvedValue({ status: 'found', food: providerFood }),
  };
  return {
    packagedFood,
    service: new NutritionService(
      repository as NutritionRepository,
      packagedFood as unknown as PackagedFoodService,
      {} as GeminiNutritionService,
    ),
  };
}

describe('NutritionService barcode fallback', () => {
  it('returns source-backed transient food when migration 004 is missing', async () => {
    const savePackagedFood = vi.fn();
    const { service } = createService({
      findFoodByBarcode: vi.fn().mockRejectedValue({ code: '42P01' }),
      savePackagedFood,
    });

    await expect(service.getBarcode('user-1', providerFood.barcode)).resolves.toMatchObject({
      ...providerFood,
      id: null,
      persisted: false,
    });
    expect(savePackagedFood).not.toHaveBeenCalled();
  });

  it('returns source-backed transient food when saving becomes unavailable', async () => {
    const { service } = createService({
      findFoodByBarcode: vi.fn().mockResolvedValue(null),
      savePackagedFood: vi.fn().mockRejectedValue(new ApiError(
        'NUTRITION_STORE_UNAVAILABLE',
        'Nutrition storage is unavailable.',
        HttpStatus.SERVICE_UNAVAILABLE,
        true,
      )),
    });

    await expect(service.getBarcode('user-1', providerFood.barcode)).resolves.toMatchObject({
      id: null,
      persisted: false,
      source: 'open_food_facts',
    });
  });

  it('does not hide unrelated repository failures', async () => {
    const { packagedFood, service } = createService({
      findFoodByBarcode: vi.fn().mockRejectedValue(new Error('connection reset')),
    });

    await expect(service.getBarcode('user-1', providerFood.barcode)).rejects.toThrow('connection reset');
    expect(packagedFood.lookup).not.toHaveBeenCalled();
  });
});
