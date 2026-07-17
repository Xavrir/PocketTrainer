import type {
  CreateFoodEntryInput,
  BarcodeNutritionFood,
  FoodCandidate,
  FoodEntry,
  NutritionDailyResponse,
  NutritionFood,
  NutritionFoodEntry,
  NutritionTotals,
  UpdateFoodEntryInput,
} from '../../api/types';

export function mapNutritionFood(food: NutritionFood | BarcodeNutritionFood): FoodCandidate {
  return {
    authoritative: food.authoritative,
    barcode: food.barcode ?? undefined,
    brandName: food.brand ?? undefined,
    ...(food.id ? { id: food.id } : {}),
    name: food.name,
    nutrition: {
      calories: food.nutritionPerServing.caloriesKcal,
      carbohydrateGrams: food.nutritionPerServing.carbohydrateG,
      fatGrams: food.nutritionPerServing.fatG,
      fiberGrams: food.nutritionPerServing.fiberG,
      proteinGrams: food.nutritionPerServing.proteinG,
      sodiumMilligrams: food.nutritionPerServing.sodiumMg,
      sugarGrams: food.nutritionPerServing.sugarG,
    },
    providerSource: food.source,
    persisted: 'persisted' in food ? food.persisted : true,
    servingAmount: food.serving.amount,
    servingUnit: food.serving.unit,
    source: food.source === 'open_food_facts' ? 'barcode' : 'custom',
  };
}

export function mapNutritionFoodEntry(entry: NutritionFoodEntry): FoodEntry {
  const nutrition = entry.food.nutritionPerServing;
  const servings = entry.servings;
  return {
    calories: nutrition.caloriesKcal * servings,
    carbohydrateGrams: nutrition.carbohydrateG * servings,
    consumedAt: entry.consumedAt,
    createdAt: entry.createdAt,
    fatGrams: nutrition.fatG * servings,
    fiberGrams: nutrition.fiberG * servings,
    food: mapNutritionFood(entry.food),
    foodItemId: entry.foodId,
    id: entry.id,
    mealType: entry.mealType,
    notes: entry.notes,
    portionAmount: servings,
    portionUnit: entry.food.serving.unit,
    proteinGrams: nutrition.proteinG * servings,
    source: entry.food.source === 'open_food_facts' ? 'barcode' : 'custom',
    sugarGrams: nutrition.sugarG * servings,
    updatedAt: entry.updatedAt,
  };
}

export function mapDailyNutrition(response: NutritionDailyResponse): {
  date: string;
  timezone: string;
  totals: NutritionTotals;
  entries: FoodEntry[];
} {
  const totals = response.totals;
  return {
    date: response.date,
    entries: response.entries.map(mapNutritionFoodEntry),
    timezone: response.timezone,
    totals: {
      calories: totals.caloriesKcal,
      carbohydrateGrams: totals.carbohydrateG,
      entryCount: response.entries.length,
      fatGrams: totals.fatG,
      fiberGrams: totals.fiberG,
      proteinGrams: totals.proteinG,
      sodiumMilligrams: totals.sodiumMg,
      sugarGrams: totals.sugarG,
    },
  };
}

export type NutritionFoodEntryRequest = {
  consumedAt?: string;
  foodId?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';
  notes?: string;
  servings?: number;
};

export function mapCreateFoodEntryRequest(
  input: CreateFoodEntryInput,
): NutritionFoodEntryRequest {
  if (!input.foodItemId?.trim()) {
    throw new Error('A food item is required to create a food entry.');
  }
  return {
    consumedAt: input.consumedAt,
    foodId: input.foodItemId,
    mealType: input.mealType,
    notes: input.notes ?? undefined,
    servings: input.portionAmount,
  };
}

export function mapUpdateFoodEntryRequest(
  input: UpdateFoodEntryInput,
): NutritionFoodEntryRequest {
  return {
    ...(input.consumedAt === undefined ? {} : { consumedAt: input.consumedAt }),
    ...(input.foodItemId === undefined ? {} : { foodId: input.foodItemId }),
    ...(input.mealType === undefined ? {} : { mealType: input.mealType }),
    ...(input.notes === undefined ? {} : { notes: input.notes ?? undefined }),
    ...(input.portionAmount === undefined
      ? {}
      : { servings: input.portionAmount }),
  };
}
