import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { InMemoryNutritionRepository } from './in-memory-nutrition.repository';

const facts = { caloriesKcal: 200, proteinG: 10, carbohydrateG: 20, fatG: 8, fiberG: 2, sugarG: 3, sodiumMg: 100 };

describe('in-memory nutrition repository', () => {
  it('supports custom foods, idempotent entries, CRUD, and daily totals', async () => {
    const repository = new InMemoryNutritionRepository();
    const userId = randomUUID();
    const food = await repository.createCustomFood(userId, 'custom-1234', { name: 'Oat bar', serving: { amount: 1, unit: 'bar' }, nutritionPerServing: facts });
    expect(food.value.authoritative).toBe(false);
    const input = { foodId: food.value.id, servings: 2, consumedAt: '2026-07-17T08:00:00+07:00', mealType: 'breakfast' as const };
    const first = await repository.createFoodEntry(userId, 'entry-1234', input);
    expect((await repository.getFoodEntry(userId, first.value.id)).id).toBe(first.value.id);
    const replay = await repository.createFoodEntry(userId, 'entry-1234', input);
    expect(replay.replayed).toBe(true);
    expect((await repository.getDailyNutrition(userId, '2026-07-17', 'Asia/Jakarta')).totals.caloriesKcal).toBe(400);
    const updated = await repository.updateFoodEntry(userId, first.value.id, 'update-1234', { servings: 1 });
    expect(updated.value.servings).toBe(1);
    expect((await repository.listFoodEntries(userId, { date: '2026-07-17', timezone: 'Asia/Jakarta', limit: 50 })).length).toBe(1);
    expect((await repository.deleteFoodEntry(userId, first.value.id, 'delete-1234')).value.deleted).toBe(true);
    expect((await repository.getPrivacyExport(userId)).entries).toHaveLength(0);
  });
});
