import {
  mapCreateFoodEntryRequest,
  mapNutritionFood,
  mapNutritionFoodEntry,
} from './nutritionMapper';
import type { NutritionFood } from '../../api/types';

const backendFood: NutritionFood = {
  authoritative: true,
  barcode: '8991234567890',
  brand: 'Example',
  id: 'food-1',
  name: 'Nasi goreng',
  nutritionPerServing: {
    caloriesKcal: 520,
    carbohydrateG: 70,
    fatG: 18,
    fiberG: 4,
    proteinG: 20,
    sodiumMg: 800,
    sugarG: 5,
  },
  serving: { amount: 1, label: '1 plate', unit: 'plate' },
  source: 'open_food_facts',
};

describe('nutrition mappers', () => {
  it('maps the backend NutritionFood contract without renaming data at call sites', () => {
    expect(mapNutritionFood(backendFood)).toEqual({
      authoritative: true,
      barcode: '8991234567890',
      brandName: 'Example',
      id: 'food-1',
      name: 'Nasi goreng',
      nutrition: {
        calories: 520,
        carbohydrateGrams: 70,
        fatGrams: 18,
        fiberGrams: 4,
        proteinGrams: 20,
        sodiumMilligrams: 800,
        sugarGrams: 5,
      },
      providerSource: 'open_food_facts',
      persisted: true,
      servingAmount: 1,
      servingUnit: 'plate',
      source: 'barcode',
    });
  });

  it('maps an optional nested backend food on an entry', () => {
    const entry = mapNutritionFoodEntry({
      consumedAt: '2026-07-17T12:00:00.000Z',
      food: backendFood,
      id: 'entry-1',
      mealType: 'lunch',
      foodId: 'food-1',
      notes: null,
      servings: 1,
      createdAt: '2026-07-17T12:00:00.000Z',
      updatedAt: '2026-07-17T12:00:00.000Z',
    });

    expect(entry.food?.providerSource).toBe('open_food_facts');
    expect(entry.food?.nutrition.calories).toBe(520);
  });

  it('maps the mobile entry draft to the backend request contract', () => {
    expect(
      mapCreateFoodEntryRequest({
        consumedAt: '2026-07-17T12:00:00.000Z',
        foodItemId: 'food-1',
        mealType: 'lunch',
        portionAmount: 2,
        portionUnit: 'plate',
        calories: 1040,
        source: 'barcode',
      }),
    ).toEqual({
      consumedAt: '2026-07-17T12:00:00.000Z',
      foodId: 'food-1',
      mealType: 'lunch',
      servings: 2,
    });
  });
});
