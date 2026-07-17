import { createHash, randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import type { IdempotencyResult } from '../domain/domain.types';
import { NutritionRepository } from './nutrition.repository';
import type {
  CustomFoodInput,
  DailyNutrition,
  FoodEntry,
  FoodEntryInput,
  FoodEntryUpdateInput,
  FoodEntryQuery,
  NutritionFacts,
  NutritionFood,
  NutritionFoodData,
} from './nutrition.types';

type StoredFood = NutritionFood & { ownerId: string | null };
type UserState = { foods: Map<string, StoredFood>; entries: Map<string, FoodEntry>; processed: Map<string, { operation: string; hash: string; value: unknown }> };

const emptyTotals = (): NutritionFacts => ({ caloriesKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 });

function hash(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function localDate(value: string, timezone: string): string { return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)); }

@Injectable()
export class InMemoryNutritionRepository extends NutritionRepository {
  private readonly globalFoods = new Map<string, StoredFood>();
  private readonly users = new Map<string, UserState>();

  async findFoodByBarcode(userId: string, barcode: string): Promise<NutritionFood | null> {
    const user = this.user(userId);
    const custom = [...user.foods.values()].find((food) => food.barcode === barcode);
    return custom ? this.publicFood(custom) : this.publicFood(this.globalFoods.get(barcode));
  }

  async savePackagedFood(_userId: string, food: NutritionFoodData): Promise<NutritionFood> {
    if (!food.barcode) throw new ApiError('FOOD_BARCODE_REQUIRED', 'A packaged food must have a barcode.', HttpStatus.BAD_REQUEST, true);
    const existing = this.globalFoods.get(food.barcode);
    if (existing) return this.publicFood(existing);
    const now = new Date().toISOString();
    const stored: StoredFood = { ...food, id: randomUUID(), createdAt: now, updatedAt: now, ownerId: null };
    this.globalFoods.set(food.barcode, stored);
    return this.publicFood(stored);
  }

  async createCustomFood(userId: string, key: string, input: CustomFoodInput): Promise<IdempotencyResult<NutritionFood>> {
    const user = this.user(userId);
    return this.idempotent(user, key, 'nutrition.food.create', input, () => {
      const now = new Date().toISOString();
      const stored: StoredFood = {
        ...input,
        barcode: input.barcode ?? null,
        brand: input.brand ?? null,
        serving: { ...input.serving, label: input.serving.label ?? null },
        id: randomUUID(), createdAt: now, updatedAt: now, source: 'custom', authoritative: false, ownerId: userId,
      };
      user.foods.set(stored.id, stored);
      return this.publicFood(stored);
    });
  }

  async listFoodEntries(userId: string, query: FoodEntryQuery): Promise<FoodEntry[]> {
    const user = this.user(userId);
    return [...user.entries.values()]
      .filter((entry) => !query.date || localDate(entry.consumedAt, query.timezone) === query.date)
      .sort((a, b) => b.consumedAt.localeCompare(a.consumedAt))
      .slice(0, query.limit);
  }

  async getFoodEntry(userId: string, entryId: string): Promise<FoodEntry> {
    const entry = this.user(userId).entries.get(entryId);
    if (!entry) throw new ApiError('FOOD_ENTRY_NOT_FOUND', 'Food entry was not found.', HttpStatus.NOT_FOUND, true);
    return entry;
  }

  async createFoodEntry(userId: string, key: string, input: FoodEntryInput): Promise<IdempotencyResult<FoodEntry>> {
    const user = this.user(userId);
    return this.idempotent(user, key, 'nutrition.entry.create', input, () => {
      const food = this.foodForUser(user, input.foodId);
      const now = new Date().toISOString();
      const entry: FoodEntry = { id: randomUUID(), foodId: food.id, food: this.publicFood(food), servings: input.servings, consumedAt: input.consumedAt, mealType: input.mealType, notes: input.notes ?? null, createdAt: now, updatedAt: now };
      user.entries.set(entry.id, entry);
      return entry;
    });
  }

  async updateFoodEntry(userId: string, entryId: string, key: string, input: FoodEntryUpdateInput): Promise<IdempotencyResult<FoodEntry>> {
    const user = this.user(userId);
    return this.idempotent(user, key, 'nutrition.entry.update', { entryId, input }, () => {
      const existing = user.entries.get(entryId);
      if (!existing) throw new ApiError('FOOD_ENTRY_NOT_FOUND', 'Food entry was not found.', HttpStatus.NOT_FOUND, true);
      const food = input.foodId ? this.foodForUser(user, input.foodId) : user.foods.get(existing.foodId) ?? this.globalFoods.get(existing.foodId);
      if (!food) throw new ApiError('FOOD_NOT_FOUND', 'The selected food was not found.', HttpStatus.NOT_FOUND, true);
      const updated: FoodEntry = {
        ...existing,
        foodId: food.id,
        food: this.publicFood(food),
        servings: input.servings ?? existing.servings,
        consumedAt: input.consumedAt ?? existing.consumedAt,
        mealType: input.mealType ?? existing.mealType,
        notes: input.notes ?? existing.notes,
        updatedAt: new Date().toISOString(),
      };
      user.entries.set(entryId, updated);
      return updated;
    });
  }

  async deleteFoodEntry(userId: string, entryId: string, key: string): Promise<IdempotencyResult<{ id: string; deleted: true }>> {
    const user = this.user(userId);
    return this.idempotent(user, key, 'nutrition.entry.delete', { entryId }, () => {
      if (!user.entries.delete(entryId)) throw new ApiError('FOOD_ENTRY_NOT_FOUND', 'Food entry was not found.', HttpStatus.NOT_FOUND, true);
      return { id: entryId, deleted: true as const };
    });
  }

  async getDailyNutrition(userId: string, date: string, timezone: string): Promise<DailyNutrition> {
    const entries = await this.listFoodEntries(userId, { date, timezone, limit: 100 });
    const totals = emptyTotals();
    for (const entry of entries) {
      for (const key of Object.keys(totals) as Array<keyof NutritionFacts>) totals[key] += entry.food.nutritionPerServing[key] * entry.servings;
    }
    return { date, timezone, totals, entries };
  }

  async getPrivacyExport(userId: string): Promise<{ foods: NutritionFood[]; entries: FoodEntry[] }> {
    const user = this.user(userId);
    return { foods: [...user.foods.values()].map(food => this.publicFood(food)), entries: [...user.entries.values()] };
  }

  async deleteUserData(userId: string): Promise<void> {
    this.users.delete(userId);
  }

  private user(userId: string): UserState {
    let state = this.users.get(userId);
    if (!state) { state = { foods: new Map(), entries: new Map(), processed: new Map() }; this.users.set(userId, state); }
    return state;
  }

  private foodForUser(user: UserState, foodId: string): StoredFood {
    const food = user.foods.get(foodId) ?? [...this.globalFoods.values()].find((candidate) => candidate.id === foodId);
    if (!food) throw new ApiError('FOOD_NOT_FOUND', 'The selected food was not found.', HttpStatus.NOT_FOUND, true);
    return food;
  }

  private publicFood(food: StoredFood): NutritionFood;
  private publicFood(food: StoredFood | undefined): NutritionFood | null;
  private publicFood(food: StoredFood | undefined): NutritionFood | null {
    if (!food) return null;
    const { ownerId: _ownerId, ...publicFood } = food;
    return publicFood;
  }

  private idempotent<T>(user: UserState, key: string, operation: string, payload: unknown, action: () => T): IdempotencyResult<T> {
    const payloadHash = hash(payload);
    const existing = user.processed.get(key);
    if (existing) {
      if (existing.operation !== operation || existing.hash !== payloadHash) throw new ApiError('IDEMPOTENCY_KEY_REUSED', 'This idempotency key was already used for a different request.', HttpStatus.CONFLICT);
      return { replayed: true, value: existing.value as T };
    }
    const value = action();
    user.processed.set(key, { operation, hash: payloadHash, value });
    return { replayed: false, value };
  }
}
