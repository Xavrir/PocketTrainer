export type NutritionSource = 'open_food_facts' | 'custom' | 'gemini_unverified';

export type NutritionFacts = {
  caloriesKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
};

export type Serving = {
  amount: number;
  unit: string;
  label: string | null;
};

export type NutritionFoodData = {
  barcode: string | null;
  name: string;
  brand: string | null;
  serving: Serving;
  nutritionPerServing: NutritionFacts;
  source: NutritionSource;
  authoritative: boolean;
};

export type NutritionFood = NutritionFoodData & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type BarcodeNutritionFood = NutritionFoodData & {
  id: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  persisted: boolean;
};

export type FoodEntry = {
  id: string;
  foodId: string;
  food: NutritionFood;
  servings: number;
  consumedAt: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NutritionTotals = NutritionFacts;

export type DailyNutrition = {
  date: string;
  timezone: string;
  totals: NutritionTotals;
  entries: FoodEntry[];
};

export type CandidateInput = {
  barcode?: string | undefined;
  label: string;
};

export type ImageCandidateInput = {
  imageBase64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  label?: string | undefined;
};

export type CustomFoodInput = {
  barcode?: string | undefined;
  name: string;
  brand?: string | undefined;
  serving: { amount: number; unit: string; label?: string | undefined };
  nutritionPerServing: NutritionFacts;
};

export type FoodEntryInput = {
  foodId: string;
  servings: number;
  consumedAt: string;
  mealType: FoodEntry['mealType'];
  notes?: string | undefined;
};

export type FoodEntryUpdateInput = {
  [Key in keyof FoodEntryInput]?: FoodEntryInput[Key] | undefined;
};

export type FoodEntryQuery = {
  date?: string | undefined;
  timezone: string;
  limit: number;
};
