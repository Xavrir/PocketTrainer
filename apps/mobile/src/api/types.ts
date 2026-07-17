export type LocalizedText = {
  id: string;
  en: string;
};

export type Profile = {
  displayName: string;
  locale: 'id' | 'en';
  timezone: string;
  primaryGoal:
    | 'build_strength'
    | 'improve_mobility'
    | 'build_consistency'
    | 'reduce_stress';
  experienceLevel: 'foundation' | 'beginner' | 'intermediate';
  equipment: string[];
  limitations: string[];
  schedule: {
    days: Weekday[];
    durationMinutes: number;
  };
  onboardingCompleted: boolean;
  updatedAt: string;
};

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type UpdateProfileInput = Omit<Profile, 'updatedAt'>;

export type ConsentType =
  | 'privacy'
  | 'camera_processing'
  | 'fitness_guidance'
  | 'analytics';

export type Consent = {
  type: ConsentType;
  granted: boolean;
  version: string;
  updatedAt: string;
};

export type UpdateConsentInput = Pick<Consent, 'granted' | 'version'>;

export type ExerciseDefinition = {
  id: string;
  exerciseKey: string;
  version: number;
  scoringVersion: string;
  poseModelVersion: string;
  name: LocalizedText;
  category: 'strength' | 'yoga' | 'mobility';
  mode: 'repetition' | 'hold';
  cameraView: 'front' | 'side';
  contentUrl: string;
};

export type Lesson = {
  id: string;
  unitId: string;
  exerciseDefinitionId: string;
  title: LocalizedText;
  summary: LocalizedText;
  order: number;
  target: { type: 'reps' | 'seconds'; value: number };
  xpReward: number;
  requirements: {
    minimumLevel: number;
    prerequisiteLessonIds: string[];
    requiredMasteryKeys: string[];
    requiredEquipment: string[];
  };
};

export type Unit = {
  id: string;
  courseId: string;
  title: LocalizedText;
  order: number;
  lessons: Lesson[];
};

export type Course = {
  id: string;
  trackId: string;
  slug: string;
  title: LocalizedText;
  description: LocalizedText;
  accent: string;
  order: number;
  units: Unit[];
};

export type Track = {
  id: string;
  slug: 'strength' | 'yoga' | 'mobility';
  title: LocalizedText;
  description: LocalizedText;
  order: number;
  courses: Course[];
};

export type Catalog = {
  version: number;
  publishedAt: string;
  contentBaseUrl: string;
  exercises: ExerciseDefinition[];
  tracks: Track[];
};

export type SkillMastery = {
  exerciseKey: string;
  bestFormScore: number;
  qualifyingSessions: number;
  mastered: boolean;
  restricted: boolean;
  updatedAt: string;
};

export type Progress = {
  xp: {
    total: number;
    today: number;
    dailyCap: number;
    level: number;
    currentLevelXp: number;
    nextLevelXp: number;
  };
  streak: {
    current: number;
    longest: number;
    todayStatus: 'active' | 'protected' | 'open';
  };
  completedLessonIds: string[];
  mastery: SkillMastery[];
  achievements: Array<{ key: string; unlockedAt: string }>;
};

export type WorkoutPlan = {
  id: string;
  revision: number;
  status: 'active';
  generatedAt: string;
  reason: LocalizedText;
  lessonIds: string[];
};

export type Bootstrap = {
  serverTime: string;
  profile: Profile | null;
  consents: Consent[];
  catalog: Catalog;
  progress: Progress;
  currentPlan: WorkoutPlan | null;
};

export type CreateWorkoutInput = {
  lessonId: string;
  startedAt: string;
  deviceId?: string;
  applicationVersion: string;
};

export type ExerciseResultInput = {
  clientResultId: string;
  exerciseDefinitionId: string;
  exerciseDefinitionVersion: number;
  scoringVersion: string;
  poseModelVersion: string;
  setNumber: number;
  totalReps: number;
  validReps: number;
  formScore?: number;
  completionScore: number;
  controlScore: number;
  consistencyScore: number;
  mainFeedbackCode?: string;
  trackingEligible: boolean;
  durationMs: number;
};

export type UploadWorkoutResultsInput = {
  results: ExerciseResultInput[];
};

export type WorkoutSession = {
  id: string;
  lessonId: string;
  status: 'in_progress' | 'completed' | 'stopped_for_safety';
  startedAt: string;
  completedAt?: string;
  results: ExerciseResultInput[];
  summary?: WorkoutCompletion;
};

export type CompleteWorkoutInput = {
  completedAt: string;
  perceivedDifficulty: number;
  painReported: boolean;
};

export type WorkoutCompletion = {
  xpAwarded: number;
  xpCapped: boolean;
  totalXp: number;
  level: number;
  masteryChanges: SkillMastery[];
  newlyUnlockedLessonIds: string[];
  planRevision: number;
  progressionSuppressed: boolean;
  safetyMessage?: LocalizedText;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    recoverable: boolean;
    requestId: string;
    details?: unknown;
  };
};

export type PrivacyExport = {
  formatVersion: 1;
  generatedAt: string;
  user: { id: string; authSubject: string };
  profile: Profile | null;
  consents: Consent[];
  assessments: Array<{
    id: string;
    status: 'in_progress' | 'completed';
    assessmentVersion: string;
    startedAt: string;
    completedAt?: string;
    result?: unknown;
  }>;
  currentPlan: WorkoutPlan | null;
  progress: Progress;
  workouts: WorkoutSession[];
  manifest: { includes: string[]; excludes: string[] };
};

export type PrivacyDeletion = {
  action: 'account_deleted';
  completedAt: string;
  manifest: { deleted: string[]; retained: string[] };
};

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';

export type NutritionSource =
  | 'database'
  | 'manual'
  | 'barcode'
  | 'custom'
  | 'image_scan'
  | 'gemini_unverified';

export type NutritionFoodSource = 'open_food_facts' | 'custom';

export type NutritionPerServing = {
  caloriesKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
};

export type FoodCandidatesRequest = Readonly<{
  label: string;
  barcode?: string;
}>;

export type FoodImageCandidatesRequest = Readonly<{
  imageBase64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  label?: string;
}>;

export type FoodCandidateSuggestion = Readonly<{
  barcode: string | null;
  name: string;
  brand: string | null;
  serving: { amount: number; unit: string; label: string | null };
  nutritionPerServing: NutritionPerServing;
  source: 'gemini_unverified';
  authoritative: false;
}>;

export type FoodCandidatesResponse = Readonly<{
  candidates: FoodCandidateSuggestion[];
  warning: string;
}>;

/** Raw nutrition contract returned by the backend food provider. */
export type NutritionFood = {
  id: string;
  name: string;
  brand?: string | null;
  barcode?: string | null;
  serving: { amount: number; unit: string; label: string | null };
  nutritionPerServing: NutritionPerServing;
  source: NutritionFoodSource;
  authoritative: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type BarcodeNutritionFood = Omit<NutritionFood, 'id' | 'createdAt' | 'updatedAt'> & {
  id: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  persisted: boolean;
};

export type NutritionProfile = {
  calories: number;
  proteinGrams?: number;
  carbohydrateGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  sugarGrams?: number;
  sodiumMilligrams?: number;
};

export type FoodCandidate = {
  id?: string;
  name: string;
  brandName?: string;
  barcode?: string;
  source: Exclude<NutritionSource, 'manual' | 'image_scan'>;
  providerSource?: NutritionFoodSource;
  authoritative: boolean;
  persisted: boolean;
  servingAmount: number;
  servingUnit: string;
  servingGrams?: number;
  nutrition: NutritionProfile;
};

export type BarcodeLookup = {
  barcode: string;
  food: FoodCandidate | null;
};

export type CustomFood = FoodCandidate & {
  id: string;
  persisted: true;
  source: 'custom';
  createdAt?: string;
  updatedAt?: string;
};

export type CreateCustomFoodInput = {
  name: string;
  brand?: string | null;
  serving: { amount: number; unit: string; label?: string };
  nutritionPerServing: NutritionPerServing;
};

export type FoodEntry = {
  id: string;
  userId?: string;
  mealType: MealType;
  consumedAt: string;
  foodItemId?: string;
  customName?: string;
  portionAmount: number;
  portionUnit: string;
  calories: number;
  proteinGrams?: number;
  carbohydrateGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  sugarGrams?: number;
  sodiumMilligrams?: number;
  source: NutritionSource;
  confidence?: number;
  food?: FoodCandidate;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type NutritionFoodEntry = {
  id: string;
  foodId: string;
  food: NutritionFood;
  servings: number;
  consumedAt: string;
  mealType: MealType;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateFoodEntryInput = Omit<FoodEntry, 'id' | 'userId'>;

export type UpdateFoodEntryInput = Partial<
  Pick<
    FoodEntry,
    | 'mealType'
    | 'consumedAt'
    | 'foodItemId'
    | 'customName'
    | 'portionAmount'
    | 'portionUnit'
    | 'calories'
    | 'proteinGrams'
    | 'carbohydrateGrams'
    | 'fatGrams'
    | 'fiberGrams'
    | 'sugarGrams'
    | 'sodiumMilligrams'
    | 'source'
    | 'confidence'
    | 'notes'
  >
>;

export type FoodEntryDeletion = {
  id: string;
  deleted: true;
};

export type NutritionTotals = NutritionProfile & {
  entryCount?: number;
};

export type DailyNutrition = {
  date: string;
  timezone: string;
  totals: NutritionTotals;
  goals?: Partial<NutritionProfile>;
  entries: FoodEntry[];
};

export type NutritionDailyResponse = {
  date: string;
  timezone: string;
  totals: NutritionPerServing;
  entries: NutritionFoodEntry[];
};
