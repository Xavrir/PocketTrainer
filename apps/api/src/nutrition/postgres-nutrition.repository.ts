import { createHash } from 'node:crypto';
import { HttpStatus, Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { ApiError } from '../common/api-error';
import { APP_CONFIG, loadConfig, type AppConfig } from '../config';
import type { IdempotencyResult } from '../domain/domain.types';
import { NutritionRepository } from './nutrition.repository';
import type {
  CustomFoodInput,
  DailyNutrition,
  FoodEntry,
  FoodEntryInput,
  FoodEntryQuery,
  FoodEntryUpdateInput,
  NutritionFacts,
  NutritionFood,
  NutritionFoodData,
} from './nutrition.types';

const FOOD_COLUMNS = `id,user_id,barcode,name,brand,serving_amount,serving_unit,serving_label,
  calories_kcal,protein_g,carbohydrate_g,fat_g,fiber_g,sugar_g,sodium_mg,source,authoritative,created_at,updated_at`;

const ENTRY_COLUMNS = `fe.id,fe.food_id,fe.servings,fe.consumed_at,fe.meal_type,fe.notes,fe.created_at,fe.updated_at,
  nf.id as nutrition_food_id,nf.user_id as nutrition_food_user_id,nf.barcode as nutrition_food_barcode,
  nf.name as nutrition_food_name,nf.brand as nutrition_food_brand,
  nf.serving_amount as nutrition_food_serving_amount,nf.serving_unit as nutrition_food_serving_unit,
  nf.serving_label as nutrition_food_serving_label,nf.calories_kcal as nutrition_food_calories_kcal,
  nf.protein_g as nutrition_food_protein_g,nf.carbohydrate_g as nutrition_food_carbohydrate_g,
  nf.fat_g as nutrition_food_fat_g,nf.fiber_g as nutrition_food_fiber_g,
  nf.sugar_g as nutrition_food_sugar_g,nf.sodium_mg as nutrition_food_sodium_mg,
  nf.source as nutrition_food_source,nf.authoritative as nutrition_food_authoritative,
  nf.created_at as nutrition_food_created_at,nf.updated_at as nutrition_food_updated_at`;

function stableHash(value: unknown): string {
  const sort = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sort);
    if (typeof input === 'object' && input !== null) {
      return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, sort(child)]));
    }
    return input;
  };
  return createHash('sha256').update(JSON.stringify(sort(value))).digest('hex');
}

function isoDate(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function emptyTotals(): NutritionFacts {
  return { caloriesKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 };
}

@Injectable()
export class PostgresNutritionRepository extends NutritionRepository implements OnApplicationShutdown {
  private readonly pool: Pool | undefined;

  constructor(@Inject(APP_CONFIG) config: AppConfig = loadConfig()) {
    super();
    this.pool = config.DATABASE_URL
      ? new Pool({
          connectionString: config.DATABASE_URL,
          max: config.DATABASE_POOL_MAX,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
          ssl: config.DATABASE_SSL ? { rejectUnauthorized: true } : undefined,
          application_name: 'pockettrainer-api',
        })
      : undefined;
  }

  async onApplicationShutdown(): Promise<void> { await this.close(); }
  async close(): Promise<void> { await this.pool?.end(); }

  async findFoodByBarcode(userId: string, barcode: string): Promise<NutritionFood | null> {
    return this.readUser(userId, async (client) => {
      const result = await client.query(`select ${FOOD_COLUMNS} from nutrition_foods
        where barcode=$1 and (user_id is null or user_id=$2)
        order by case when user_id=$2 then 0 else 1 end limit 1`, [barcode, userId]);
      return result.rows[0] ? this.mapFood(result.rows[0]) : null;
    });
  }

  async savePackagedFood(userId: string, food: NutritionFoodData): Promise<NutritionFood> {
    if (!food.barcode) throw new ApiError('FOOD_BARCODE_REQUIRED', 'A packaged food must have a barcode.', HttpStatus.BAD_REQUEST, true);
    return this.readUser(userId, async (client) => {
      const result = await client.query(`insert into nutrition_foods
        (user_id,barcode,name,brand,serving_amount,serving_unit,serving_label,calories_kcal,protein_g,
         carbohydrate_g,fat_g,fiber_g,sugar_g,sodium_mg,source,authoritative)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        on conflict (user_id,barcode) where user_id is not null and barcode is not null do update set
          name=excluded.name,brand=excluded.brand,serving_amount=excluded.serving_amount,
          serving_unit=excluded.serving_unit,serving_label=excluded.serving_label,
          calories_kcal=excluded.calories_kcal,protein_g=excluded.protein_g,
          carbohydrate_g=excluded.carbohydrate_g,fat_g=excluded.fat_g,fiber_g=excluded.fiber_g,
          sugar_g=excluded.sugar_g,sodium_mg=excluded.sodium_mg,source=excluded.source,
          authoritative=excluded.authoritative,updated_at=now()
        returning ${FOOD_COLUMNS}`, [
        userId, food.barcode, food.name, food.brand, food.serving.amount, food.serving.unit, food.serving.label,
        food.nutritionPerServing.caloriesKcal, food.nutritionPerServing.proteinG,
        food.nutritionPerServing.carbohydrateG, food.nutritionPerServing.fatG,
        food.nutritionPerServing.fiberG, food.nutritionPerServing.sugarG,
        food.nutritionPerServing.sodiumMg, food.source, food.authoritative,
      ]);
      return this.mapFood(result.rows[0]!);
    });
  }

  async createCustomFood(userId: string, key: string, input: CustomFoodInput): Promise<IdempotencyResult<NutritionFood>> {
    return this.idempotent(userId, key, 'nutrition.food.create', input, async (client) => {
      const result = await client.query(`insert into nutrition_foods
        (user_id,barcode,name,brand,serving_amount,serving_unit,serving_label,calories_kcal,protein_g,
         carbohydrate_g,fat_g,fiber_g,sugar_g,sodium_mg,source,authoritative)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'custom',false)
        returning ${FOOD_COLUMNS}`, [
        userId, input.barcode ?? null, input.name, input.brand ?? null, input.serving.amount,
        input.serving.unit, input.serving.label ?? null, input.nutritionPerServing.caloriesKcal,
        input.nutritionPerServing.proteinG, input.nutritionPerServing.carbohydrateG,
        input.nutritionPerServing.fatG, input.nutritionPerServing.fiberG,
        input.nutritionPerServing.sugarG, input.nutritionPerServing.sodiumMg,
      ]);
      return this.mapFood(result.rows[0]!);
    });
  }

  async listFoodEntries(userId: string, query: FoodEntryQuery): Promise<FoodEntry[]> {
    return this.readUser(userId, (client) => this.listFoodEntriesFromClient(client, userId, query));
  }

  async getFoodEntry(userId: string, entryId: string): Promise<FoodEntry> {
    return this.readUser(userId, async (client) => {
      const result = await client.query(`select ${ENTRY_COLUMNS} from food_entries fe
        join nutrition_foods nf on nf.id=fe.food_id where fe.id=$1 and fe.user_id=$2`, [entryId, userId]);
      if (!result.rows[0]) throw new ApiError('FOOD_ENTRY_NOT_FOUND', 'Food entry was not found.', HttpStatus.NOT_FOUND, true);
      return this.mapEntry(result.rows[0]);
    });
  }

  async createFoodEntry(userId: string, key: string, input: FoodEntryInput): Promise<IdempotencyResult<FoodEntry>> {
    return this.idempotent(userId, key, 'nutrition.entry.create', input, async (client) => {
      const food = await this.findFoodById(client, userId, input.foodId);
      const result = await client.query(`insert into food_entries
        (user_id,food_id,servings,consumed_at,meal_type,notes)
        values ($1,$2,$3,$4,$5,$6)
        returning id,food_id,servings,consumed_at,meal_type,notes,created_at,updated_at`, [
        userId, food.id, input.servings, input.consumedAt, input.mealType, input.notes ?? null,
      ]);
      return this.mapEntry(result.rows[0]!, food);
    });
  }

  async updateFoodEntry(userId: string, entryId: string, key: string, input: FoodEntryUpdateInput): Promise<IdempotencyResult<FoodEntry>> {
    return this.idempotent(userId, key, 'nutrition.entry.update', { entryId, input }, async (client) => {
      const existingResult = await client.query(`select id,food_id,servings,consumed_at,meal_type,notes,created_at,updated_at
        from food_entries where id=$1 and user_id=$2 for update`, [entryId, userId]);
      const existing = existingResult.rows[0];
      if (!existing) throw new ApiError('FOOD_ENTRY_NOT_FOUND', 'Food entry was not found.', HttpStatus.NOT_FOUND, true);

      const food = await this.findFoodById(client, userId, input.foodId ?? String(existing.food_id));
      const result = await client.query(`update food_entries set
        food_id=$3,servings=$4,consumed_at=$5,meal_type=$6,notes=$7,updated_at=now()
        where id=$1 and user_id=$2
        returning id,food_id,servings,consumed_at,meal_type,notes,created_at,updated_at`, [
        entryId, userId, food.id, input.servings ?? Number(existing.servings),
        input.consumedAt ?? existing.consumed_at, input.mealType ?? existing.meal_type,
        input.notes ?? existing.notes,
      ]);
      return this.mapEntry(result.rows[0]!, food);
    });
  }

  async deleteFoodEntry(userId: string, entryId: string, key: string): Promise<IdempotencyResult<{ id: string; deleted: true }>> {
    return this.idempotent(userId, key, 'nutrition.entry.delete', { entryId }, async (client) => {
      const result = await client.query('delete from food_entries where id=$1 and user_id=$2 returning id', [entryId, userId]);
      if (!result.rows[0]) throw new ApiError('FOOD_ENTRY_NOT_FOUND', 'Food entry was not found.', HttpStatus.NOT_FOUND, true);
      return { id: String(result.rows[0].id), deleted: true as const };
    });
  }

  async getDailyNutrition(userId: string, date: string, timezone: string): Promise<DailyNutrition> {
    return this.readUser(userId, async (client) => {
      const entries = await this.listFoodEntriesFromClient(client, userId, { date, timezone, limit: 100 });
      const totals = emptyTotals();
      for (const entry of entries) {
        for (const key of Object.keys(totals) as Array<keyof NutritionFacts>) totals[key] += entry.food.nutritionPerServing[key] * entry.servings;
      }
      return { date, timezone, totals, entries };
    });
  }

  async getPrivacyExport(userId: string): Promise<{ foods: NutritionFood[]; entries: FoodEntry[] }> {
    return this.readUser(userId, async (client) => {
      const foods = await client.query(`select ${FOOD_COLUMNS} from nutrition_foods where user_id=$1 order by created_at`, [userId]);
      const entries = await client.query(`select ${ENTRY_COLUMNS} from food_entries fe
        join nutrition_foods nf on nf.id=fe.food_id where fe.user_id=$1 order by fe.consumed_at`, [userId]);
      return { foods: foods.rows.map(row => this.mapFood(row)), entries: entries.rows.map(row => this.mapEntry(row)) };
    });
  }

  async deleteUserData(userId: string): Promise<void> {
    await this.readUser(userId, async (client) => {
      await client.query('delete from food_entries where user_id=$1', [userId]);
      await client.query('delete from nutrition_foods where user_id=$1', [userId]);
    });
  }

  private async listFoodEntriesFromClient(client: PoolClient, userId: string, query: FoodEntryQuery): Promise<FoodEntry[]> {
    const result = await client.query(`select ${ENTRY_COLUMNS} from food_entries fe
      join nutrition_foods nf on nf.id=fe.food_id
      where fe.user_id=$1 and ($2::date is null or (fe.consumed_at at time zone $3)::date=$2::date)
      order by fe.consumed_at desc limit $4`, [userId, query.date ?? null, query.timezone, query.limit]);
    return result.rows.map((row) => this.mapEntry(row));
  }

  private async findFoodById(client: PoolClient, userId: string, foodId: string): Promise<NutritionFood> {
    const result = await client.query(`select ${FOOD_COLUMNS} from nutrition_foods
      where id=$1 and (user_id is null or user_id=$2)`, [foodId, userId]);
    const row = result.rows[0];
    if (!row) throw new ApiError('FOOD_NOT_FOUND', 'The selected food was not found.', HttpStatus.NOT_FOUND, true);
    return this.mapFood(row);
  }

  private async readUser<T>(userId: string, action: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new ApiError(
        'NUTRITION_STORE_UNAVAILABLE',
        'Nutrition PostgreSQL storage is not configured. Apply migration 004 and configure DATABASE_URL.',
        HttpStatus.SERVICE_UNAVAILABLE,
        true,
      );
    }
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query("select set_config('app.current_user_id',$1,true)", [userId]);
      await client.query("set local statement_timeout='5s'");
      const result = await action(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private async idempotent<T>(userId: string, key: string, operation: string, payload: unknown, action: (client: PoolClient) => Promise<T>): Promise<IdempotencyResult<T>> {
    const payloadHash = stableHash(payload);
    return this.readUser(userId, async (client) => {
      await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`${userId}:${key}`]);
      const existing = await client.query<{ event_type: string; payload_hash: string; response: T }>(
        'select event_type,payload_hash,response from processed_client_events where user_id=$1 and idempotency_key=$2',
        [userId, key],
      );
      const row = existing.rows[0];
      if (row) {
        if (row.event_type !== operation || row.payload_hash !== payloadHash) {
          throw new ApiError('IDEMPOTENCY_KEY_REUSED', 'This idempotency key was already used for a different request.', HttpStatus.CONFLICT);
        }
        return { replayed: true, value: row.response };
      }
      const value = await action(client);
      await client.query(`insert into processed_client_events
        (user_id,idempotency_key,event_type,payload_hash,response)
        values ($1,$2,$3,$4,$5)`, [userId, key, operation, payloadHash, JSON.stringify(value)]);
      return { replayed: false, value };
    });
  }

  private mapFood(row: QueryResultRow, prefix = ''): NutritionFood {
    const value = (column: string): unknown => row[`${prefix}${column}`];
    return {
      id: String(value('id')),
      barcode: value('barcode') === null || value('barcode') === undefined ? null : String(value('barcode')),
      name: String(value('name')),
      brand: value('brand') === null || value('brand') === undefined ? null : String(value('brand')),
      serving: {
        amount: Number(value('serving_amount')),
        unit: String(value('serving_unit')),
        label: value('serving_label') === null || value('serving_label') === undefined ? null : String(value('serving_label')),
      },
      nutritionPerServing: {
        caloriesKcal: Number(value('calories_kcal')),
        proteinG: Number(value('protein_g')),
        carbohydrateG: Number(value('carbohydrate_g')),
        fatG: Number(value('fat_g')),
        fiberG: Number(value('fiber_g')),
        sugarG: Number(value('sugar_g')),
        sodiumMg: Number(value('sodium_mg')),
      },
      source: value('source') as NutritionFood['source'],
      authoritative: Boolean(value('authoritative')),
      createdAt: isoDate(value('created_at')),
      updatedAt: isoDate(value('updated_at')),
    };
  }

  private mapEntry(row: QueryResultRow, food?: NutritionFood): FoodEntry {
    return {
      id: String(row.id),
      foodId: String(row.food_id),
      food: food ?? this.mapFood(row, 'nutrition_food_'),
      servings: Number(row.servings),
      consumedAt: isoDate(row.consumed_at),
      mealType: row.meal_type as FoodEntry['mealType'],
      notes: row.notes === null || row.notes === undefined ? null : String(row.notes),
      createdAt: isoDate(row.created_at),
      updatedAt: isoDate(row.updated_at),
    };
  }
}
