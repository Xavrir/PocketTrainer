import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { PostgresNutritionRepository } from './postgres-nutrition.repository';

const ownerUrl = process.env.TEST_DATABASE_URL;
const runtimeUrl = process.env.TEST_DATABASE_RUNTIME_URL;
const databaseDescribe = ownerUrl && runtimeUrl ? describe : describe.skip;

databaseDescribe('PostgresNutritionRepository integration', () => {
  const userA = randomUUID();
  const userB = randomUUID();
  const globalFoodId = randomUUID();
  const owner = new Pool({ connectionString: ownerUrl });
  const runtime = new Pool({ connectionString: runtimeUrl });
  const repository = new PostgresNutritionRepository(loadConfig({
    NODE_ENV: 'test',
    DATA_STORE: 'postgres',
    DATABASE_URL: runtimeUrl,
    DATABASE_SSL: 'false',
    DATABASE_POOL_MAX: '2',
    ALLOW_INSECURE_DEV_AUTH: 'true',
    OUTBOX_POLL_MS: '0',
  }));

  beforeAll(async () => {
    await owner.query('insert into users(id) values ($1),($2)', [userA, userB]);
    await owner.query(`insert into nutrition_foods
      (id,user_id,barcode,name,serving_amount,serving_unit,calories_kcal,protein_g,carbohydrate_g,fat_g,source,authoritative)
      values ($1,null,'3017620422003','Global provider food',15,'g',80,1,9,4,'open_food_facts',true)`, [globalFoodId]);
  });

  afterAll(async () => {
    await repository.close();
    await runtime.end();
    await owner.query('delete from nutrition_foods where id=$1', [globalFoodId]);
    await owner.query('delete from users where id=any($1::uuid[])', [[userA, userB]]);
    await owner.end();
  });

  it('persists barcode foods per user and enforces entry ownership and daily totals', async () => {
    const food = await repository.savePackagedFood(userA, {
      barcode: '8999999999993',
      name: 'Provider food',
      brand: 'Test brand',
      serving: { amount: 20, unit: 'g', label: '20 g' },
      nutritionPerServing: {
        caloriesKcal: 100,
        proteinG: 10,
        carbohydrateG: 20,
        fatG: 5,
        fiberG: 2,
        sugarG: 4,
        sodiumMg: 50,
      },
      source: 'open_food_facts',
      authoritative: true,
    });

    await expect(repository.findFoodByBarcode(userA, '8999999999993')).resolves.toMatchObject({ id: food.id });
    await expect(repository.findFoodByBarcode(userB, '8999999999993')).resolves.toBeNull();

    const entry = await repository.createFoodEntry(userA, randomUUID(), {
      foodId: food.id,
      servings: 2,
      consumedAt: '2026-07-17T01:00:00.000Z',
      mealType: 'breakfast',
    });
    expect(entry.value.foodId).toBe(food.id);
    await expect(repository.getDailyNutrition(userA, '2026-07-17', 'Asia/Jakarta')).resolves.toMatchObject({
      totals: { caloriesKcal: 200, proteinG: 20, carbohydrateG: 40, fatG: 10 },
    });
    await expect(repository.createFoodEntry(userB, randomUUID(), {
      foodId: food.id,
      servings: 1,
      consumedAt: '2026-07-17T01:00:00.000Z',
      mealType: 'snack',
    })).rejects.toMatchObject({ response: { code: 'FOOD_NOT_FOUND' } });

    const client = await runtime.connect();
    try {
      await client.query('begin');
      await client.query("select set_config('app.current_user_id',$1,true)", [userB]);
      await expect(client.query(`insert into food_entries
        (user_id,food_id,servings,consumed_at,meal_type) values ($1,$2,1,now(),'snack')`, [userB, food.id]))
        .rejects.toMatchObject({ code: '42501' });
      await client.query('rollback');

      await client.query('begin');
      await client.query("select set_config('app.current_user_id',$1,true)", [userB]);
      await expect(client.query('select id from nutrition_foods where id=$1', [globalFoodId]))
        .resolves.toMatchObject({ rowCount: 1 });
      await expect(client.query("update nutrition_foods set name='tampered' where id=$1", [globalFoodId]))
        .resolves.toMatchObject({ rowCount: 0 });
      await client.query('rollback');
    } finally {
      client.release();
    }
  });
});
