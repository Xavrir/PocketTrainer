import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config';
import { normalizeBarcode } from './nutrition.schemas';
import type { NutritionFoodData } from './nutrition.types';

export type FoodLookupResult = { status: 'found' | 'not_found' | 'unavailable'; food?: NutritionFoodData };

const MAX_UPSTREAM_RESPONSE_BYTES = 256 * 1024;

function numberValue(value: unknown): number | null {
  if (typeof value === 'string' && !value.trim()) return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function serving(value: unknown): { amount: number; unit: string; label: string | null } {
  const label = typeof value === 'string' && value.trim() ? value.trim() : null;
  const match = label?.match(/([\d.]+)\s*(mg|ml|g|kg|oz|serving)\b/i);
  if (!match) return { amount: 1, unit: 'serving', label };
  const amount = Number(match[1]);
  return { amount: Number.isFinite(amount) && amount > 0 ? amount : 1, unit: match[2]!.toLowerCase(), label };
}

@Injectable()
export class PackagedFoodService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async lookup(barcode: string): Promise<FoodLookupResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.NUTRITION_LOOKUP_TIMEOUT_MS);
    try {
      const url = `${this.config.OPEN_FOOD_FACTS_BASE_URL.replace(/\/$/, '')}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,brands,serving_size,nutriments`;
      const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json', 'user-agent': 'PocketTrainer/0.2 nutrition lookup' } });
      if (response.status === 404) return { status: 'not_found' };
      if (!response.ok) return { status: 'unavailable' };
      const payload = await this.readJson(response);
      if (payload === null) return { status: 'unavailable' };
      if (!payload || typeof payload !== 'object' || !('status' in payload)) return { status: 'unavailable' };
      const upstreamStatus = typeof payload.status === 'number'
        ? payload.status
        : typeof payload.status === 'string' && payload.status.trim() ? Number(payload.status) : Number.NaN;
      if (upstreamStatus === 0) return { status: 'not_found' };
      if (upstreamStatus !== 1 || !('product' in payload)) return { status: 'unavailable' };
      const product = payload.product;
      if (!product || typeof product !== 'object') return { status: 'unavailable' };
      const data = product as Record<string, unknown>;
      if (data.code !== undefined && normalizeBarcode(String(data.code)) !== barcode) return { status: 'unavailable' };
      const nutriments = data.nutriments && typeof data.nutriments === 'object' ? data.nutriments as Record<string, unknown> : {};
      const value = (key: string): number | null => numberValue(nutriments[`${key}_serving`] ?? nutriments[`${key}_100g`]);
      const calories = value('energy-kcal');
      const protein = value('proteins');
      const carbs = value('carbohydrates');
      const fat = value('fat');
      const name = typeof data.product_name === 'string' ? data.product_name.trim() : '';
      if (!name || calories === null || protein === null || carbs === null || fat === null) return { status: 'unavailable' };
      const sodiumGrams = value('sodium');
      return {
        status: 'found',
        food: {
          barcode,
          name,
          brand: typeof data.brands === 'string' && data.brands.trim() ? data.brands.split(',')[0]!.trim() : null,
          serving: serving(data.serving_size),
          nutritionPerServing: { caloriesKcal: calories, proteinG: protein, carbohydrateG: carbs, fatG: fat, fiberG: value('fiber') ?? 0, sugarG: value('sugars') ?? 0, sodiumMg: sodiumGrams === null ? 0 : sodiumGrams * 1000 },
          source: 'open_food_facts',
          authoritative: true,
        },
      };
    } catch (error) {
      return { status: 'unavailable' };
    } finally { clearTimeout(timeout); }
  }

  private async readJson(response: Response): Promise<unknown | null> {
    const contentLength = response.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_UPSTREAM_RESPONSE_BYTES) return null;

    // Real fetch responses use text(), which lets us enforce a byte limit
    // before JSON parsing. The json() fallback keeps lightweight unit doubles
    // compatible without weakening production responses.
    if (typeof response.text === 'function') {
      const text = await response.text();
      if (Buffer.byteLength(text, 'utf8') > MAX_UPSTREAM_RESPONSE_BYTES) return null;
      try { return JSON.parse(text) as unknown; } catch { return null; }
    }
    if (typeof response.json === 'function') return response.json() as Promise<unknown>;
    return null;
  }
}
