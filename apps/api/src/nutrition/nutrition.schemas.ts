import { z } from 'zod';

const nutritionFactsSchema = z.object({
  caloriesKcal: z.number().finite().min(0).max(100_000),
  proteinG: z.number().finite().min(0).max(10_000),
  carbohydrateG: z.number().finite().min(0).max(10_000),
  fatG: z.number().finite().min(0).max(10_000),
  fiberG: z.number().finite().min(0).max(10_000).default(0),
  sugarG: z.number().finite().min(0).max(10_000).default(0),
  sodiumMg: z.number().finite().min(0).max(100_000).default(0),
}).strict();

const servingSchema = z.object({
  amount: z.number().finite().positive().max(100_000),
  unit: z.string().trim().min(1).max(32),
  label: z.string().trim().min(1).max(80).optional(),
}).strict();

/**
 * Normalize the scanner formats we support to the canonical code sent to
 * Open Food Facts. UPC-A and distinguishable UPC-E values are represented as
 * zero-padded EAN-13. Separators are accepted because some scanner SDKs include
 * them in the raw value; all other characters and invalid check digits are
 * rejected. An 8-digit value valid as both EAN-8 and UPC-E is rejected because
 * this API receives no scanner-format metadata and cannot resolve it honestly.
 */
function hasValidCheckDigit(digits: string): boolean {
  const checkDigit = Number(digits.at(-1));
  let sum = 0;
  let weight = 3;
  for (let index = digits.length - 2; index >= 0; index -= 1) {
    sum += Number(digits[index]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10 === checkDigit;
}

function expandUpcE(digits: string): string | null {
  if (digits.length !== 8 || digits[0] !== '0') return null;
  const numberSystem = digits[0];
  const body = digits.slice(1, 7);
  const checkDigit = digits[7];
  const compressionDigit = body[5];

  let manufacturerAndItem: string;
  if (compressionDigit === '0' || compressionDigit === '1' || compressionDigit === '2') {
    manufacturerAndItem = `${body.slice(0, 2)}${compressionDigit}0000${body.slice(2, 5)}`;
  } else if (compressionDigit === '3') {
    if (Number(body[2]) < 3) return null;
    manufacturerAndItem = `${body.slice(0, 3)}00000${body.slice(3, 5)}`;
  } else if (compressionDigit === '4') {
    if (body[3] === '0') return null;
    manufacturerAndItem = `${body.slice(0, 4)}00000${body[4]}`;
  } else {
    if (body[4] === '0') return null;
    manufacturerAndItem = `${body.slice(0, 5)}0000${compressionDigit}`;
  }

  const upcA = `${numberSystem}${manufacturerAndItem}${checkDigit}`;
  return hasValidCheckDigit(upcA) ? upcA : null;
}

export function normalizeBarcode(value: string): string | null {
  const digits = value.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits) || ![8, 12, 13].includes(digits.length)) return null;

  if (digits.length === 8) {
    const validEan8 = hasValidCheckDigit(digits);
    const expandedUpcA = expandUpcE(digits);
    if (validEan8 === Boolean(expandedUpcA)) return null;
    return expandedUpcA ? `0${expandedUpcA}` : digits;
  }

  if (!hasValidCheckDigit(digits)) return null;
  return digits.length === 12 ? `0${digits}` : digits;
}

export const barcodeSchema = z.string().trim().min(1).max(32).transform((value, context) => {
  const normalized = normalizeBarcode(value);
  if (!normalized) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Barcode must be an unambiguous, valid EAN-8, EAN-13, UPC-A, or UPC-E code.' });
    return z.NEVER;
  }
  return normalized;
});

export const customFoodSchema = z.object({
  barcode: barcodeSchema.optional(),
  name: z.string().trim().min(1).max(160),
  brand: z.string().trim().min(1).max(120).optional(),
  serving: servingSchema,
  nutritionPerServing: nutritionFactsSchema,
}).strict();

export const foodEntrySchema = z.object({
  foodId: z.string().uuid(),
  servings: z.number().finite().positive().max(100),
  consumedAt: z.string().datetime({ offset: true }),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'other']),
  notes: z.string().trim().max(500).optional(),
}).strict();

export const updateFoodEntrySchema = foodEntrySchema.partial().strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const foodEntryQuerySchema = z.object({
  date: dateSchema.optional(),
  timezone: z.string().trim().min(1).max(64).default('Asia/Jakarta'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export const dailyNutritionQuerySchema = z.object({
  date: dateSchema.optional(),
  timezone: z.string().trim().min(1).max(64).default('Asia/Jakarta'),
}).strict();

export const candidateInputSchema = z.object({
  barcode: barcodeSchema.optional(),
  label: z.string().trim().min(2).max(500),
}).strict();

const imageBase64Schema = z.string()
  .min(8)
  .max(900_000)
  .regex(/^[A-Za-z0-9+/]*={0,2}$/, 'Image data must be base64 encoded.');

export const imageCandidateInputSchema = z.object({
  imageBase64: imageBase64Schema,
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  label: z.string().trim().min(2).max(500).optional(),
}).strict();
