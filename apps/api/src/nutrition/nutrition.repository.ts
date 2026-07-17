import type { IdempotencyResult } from '../domain/domain.types';
import type {
  CustomFoodInput,
  DailyNutrition,
  FoodEntry,
  FoodEntryInput,
  FoodEntryUpdateInput,
  FoodEntryQuery,
  NutritionFood,
  NutritionFoodData,
} from './nutrition.types';

export abstract class NutritionRepository {
  abstract findFoodByBarcode(userId: string, barcode: string): Promise<NutritionFood | null>;
  abstract savePackagedFood(userId: string, food: NutritionFoodData): Promise<NutritionFood>;
  abstract createCustomFood(userId: string, key: string, input: CustomFoodInput): Promise<IdempotencyResult<NutritionFood>>;
  abstract getFoodEntry(userId: string, entryId: string): Promise<FoodEntry>;
  abstract listFoodEntries(userId: string, query: FoodEntryQuery): Promise<FoodEntry[]>;
  abstract createFoodEntry(userId: string, key: string, input: FoodEntryInput): Promise<IdempotencyResult<FoodEntry>>;
  abstract updateFoodEntry(userId: string, entryId: string, key: string, input: FoodEntryUpdateInput): Promise<IdempotencyResult<FoodEntry>>;
  abstract deleteFoodEntry(userId: string, entryId: string, key: string): Promise<IdempotencyResult<{ id: string; deleted: true }>>;
  abstract getDailyNutrition(userId: string, date: string, timezone: string): Promise<DailyNutrition>;
  abstract getPrivacyExport(userId: string): Promise<{ foods: NutritionFood[]; entries: FoodEntry[] }>;
  abstract deleteUserData(userId: string): Promise<void>;
}
