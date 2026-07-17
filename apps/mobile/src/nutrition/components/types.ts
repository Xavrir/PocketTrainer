export type NutritionStatus = 'verified' | 'needs-confirmation' | 'unverified';

export type NutritionNutrients = Readonly<{
  calories: number | null;
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  sodiumMilligrams: number | null;
  sugarGrams: number | null;
}>;

export type NutritionSource = Readonly<{
  label: string;
  detail?: string;
  url?: string;
  retrievedAt?: string;
}>;

export type NutritionFacts = Readonly<{
  foodName: string;
  servingLabel: string;
  nutrients: NutritionNutrients;
  status: NutritionStatus;
  source?: NutritionSource | null;
  barcode?: string;
  notes?: string;
}>;

export type ManualLabelInput = Readonly<{
  foodName: string;
  servingLabel: string;
  nutrients: NutritionNutrients;
  sourceLabel?: string;
  barcode?: string;
}>;

export type FoodCandidateReview = Readonly<{
  foodName: string;
  brand?: string | null;
  servingLabel: string;
  nutrients: NutritionNutrients;
  barcode?: string;
}>;

export type FoodCandidateReviewResponse = Readonly<{
  candidates: readonly FoodCandidateReview[];
  warning: string;
}>;

export type NutritionDiaryEntry = Readonly<{
  id: string;
  mealType?: NutritionMealType;
  mealLabel: string;
  loggedAtLabel: string;
  servings: number;
  facts: NutritionFacts;
  syncStatus?: NutritionSyncStatus;
}>;

export type NutritionMealType =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snack'
  | 'other';

export type NutritionDiaryEntryUpdate = Readonly<{
  mealType: NutritionMealType;
  servings: number;
}>;

export type NutritionSyncStatus =
  | 'server-confirmed'
  | 'waiting-to-sync'
  | 'session-only'
  | 'sync-failed';

export type NutrientKey = keyof NutritionNutrients;

export type DailyNutrientTotal = Readonly<{
  value: number;
  complete: boolean;
  unknownEntryCount: number;
}>;

export type DailyNutritionTotals = Readonly<
  Record<NutrientKey, DailyNutrientTotal>
>;

export type NutritionDiarySummary = Readonly<{
  totals: DailyNutritionTotals;
  status: NutritionSyncStatus;
}>;

export const emptyNutritionNutrients: NutritionNutrients = {
  calories: null,
  proteinGrams: null,
  carbohydrateGrams: null,
  fatGrams: null,
  fiberGrams: null,
  sodiumMilligrams: null,
  sugarGrams: null,
};

export function createFactsFromManualLabel(
  input: ManualLabelInput,
): NutritionFacts {
  return {
    foodName: input.foodName.trim(),
    servingLabel: input.servingLabel.trim(),
    nutrients: input.nutrients,
    status: 'needs-confirmation',
    barcode: input.barcode?.trim() || undefined,
    source: input.sourceLabel?.trim()
      ? {
          label: input.sourceLabel.trim(),
          detail: 'Diinput manual dari label kemasan.',
        }
      : null,
  };
}

export function calculateDailyTotals(
  entries: readonly NutritionDiaryEntry[],
): DailyNutritionTotals {
  const keys: readonly NutrientKey[] = [
    'calories',
    'proteinGrams',
    'carbohydrateGrams',
    'fatGrams',
    'fiberGrams',
    'sodiumMilligrams',
    'sugarGrams',
  ];

  return keys.reduce((totals, key) => {
    let value = 0;
    let unknownEntryCount = 0;
    for (const entry of entries) {
      const nutrient = entry.facts.nutrients[key];
      if (nutrient === null) {
        unknownEntryCount += 1;
        continue;
      }
      value += nutrient * Math.max(0, entry.servings);
    }
    totals[key] = {
      value,
      complete: unknownEntryCount === 0,
      unknownEntryCount,
    };
    return totals;
  }, {} as Record<NutrientKey, DailyNutrientTotal>);
}
