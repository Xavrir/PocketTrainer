import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { NutritionRepository } from './nutrition.repository';
import { GeminiNutritionService } from './gemini-nutrition.service';
import { PackagedFoodService } from './packaged-food.service';
import type { BarcodeNutritionFood, CandidateInput, CustomFoodInput, FoodEntryInput, FoodEntryQuery, FoodEntryUpdateInput, ImageCandidateInput, NutritionFood, NutritionFoodData } from './nutrition.types';

function isNutritionStoreUnavailable(error: unknown): boolean {
  if (error instanceof ApiError) {
    const response = error.getResponse();
    return typeof response === 'object' && response !== null &&
      'code' in response && response.code === 'NUTRITION_STORE_UNAVAILABLE';
  }
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  return error.code === '42P01' || error.code === '42501';
}

function persistedFood(food: NutritionFood): BarcodeNutritionFood {
  return { ...food, persisted: true };
}

function transientFood(food: NutritionFoodData): BarcodeNutritionFood {
  return {
    ...food,
    id: null,
    createdAt: null,
    updatedAt: null,
    persisted: false,
  };
}

@Injectable()
export class NutritionService {
  constructor(
    @Inject(NutritionRepository) private readonly repository: NutritionRepository,
    @Inject(PackagedFoodService) private readonly packagedFood: PackagedFoodService,
    @Inject(GeminiNutritionService) private readonly gemini: GeminiNutritionService,
  ) {}

  async getBarcode(userId: string, barcode: string): Promise<BarcodeNutritionFood> {
    let storeAvailable = true;
    try {
      const existing = await this.repository.findFoodByBarcode(userId, barcode);
      if (existing) return persistedFood(existing);
    } catch (error) {
      if (!isNutritionStoreUnavailable(error)) throw error;
      storeAvailable = false;
    }
    const lookup = await this.packagedFood.lookup(barcode);
    if (lookup.status === 'found' && lookup.food) {
      if (!storeAvailable) return transientFood(lookup.food);
      try {
        return persistedFood(await this.repository.savePackagedFood(userId, lookup.food));
      } catch (error) {
        if (isNutritionStoreUnavailable(error)) return transientFood(lookup.food);
        throw error;
      }
    }
    if (lookup.status === 'unavailable') throw new ApiError('FOOD_LOOKUP_UNAVAILABLE', 'The packaged-food provider is temporarily unavailable.', HttpStatus.SERVICE_UNAVAILABLE, true);
    throw new ApiError('FOOD_NOT_FOUND', 'No packaged-food nutrition record was found for this barcode.', HttpStatus.NOT_FOUND, true);
  }

  createCustomFood(userId: string, key: string, input: CustomFoodInput) { return this.repository.createCustomFood(userId, key, input); }
  getFoodEntry(userId: string, entryId: string) { return this.repository.getFoodEntry(userId, entryId); }
  listFoodEntries(userId: string, query: FoodEntryQuery) { return this.repository.listFoodEntries(userId, query); }
  createFoodEntry(userId: string, key: string, input: FoodEntryInput) { return this.repository.createFoodEntry(userId, key, input); }
  updateFoodEntry(userId: string, entryId: string, key: string, input: FoodEntryUpdateInput) { return this.repository.updateFoodEntry(userId, entryId, key, input); }
  deleteFoodEntry(userId: string, entryId: string, key: string) { return this.repository.deleteFoodEntry(userId, entryId, key); }

  getDailyNutrition(userId: string, date: string | undefined, timezone: string) {
    const resolvedDate = date ?? new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return this.repository.getDailyNutrition(userId, resolvedDate, timezone);
  }

  generateCandidates(input: CandidateInput) { return this.gemini.generateCandidates(input); }
  generateImageCandidates(input: ImageCandidateInput) { return this.gemini.generateImageCandidates(input); }
  getPrivacyExport(userId: string) { return this.repository.getPrivacyExport(userId); }
  deleteUserData(userId: string) { return this.repository.deleteUserData(userId); }
}
