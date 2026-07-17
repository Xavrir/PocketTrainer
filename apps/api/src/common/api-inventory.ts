export type ApiEndpoint = Readonly<{
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  authentication: 'public' | 'bearer';
  idempotency: 'required' | 'not_applicable';
  response: string;
}>;

/** The implemented v1 REST surface. Keep this list in lockstep with controllers. */
export const API_ENDPOINTS = [
  { method: 'GET', path: '/health', authentication: 'public', idempotency: 'not_applicable', response: 'HealthStatus' },
  { method: 'GET', path: '/health/ready', authentication: 'public', idempotency: 'not_applicable', response: 'ReadinessStatus' },
  { method: 'GET', path: '/v1/catalog', authentication: 'public', idempotency: 'not_applicable', response: 'Catalog' },
  { method: 'GET', path: '/v1/bootstrap', authentication: 'bearer', idempotency: 'not_applicable', response: 'Bootstrap' },
  { method: 'GET', path: '/v1/profile', authentication: 'bearer', idempotency: 'not_applicable', response: 'Profile' },
  { method: 'PUT', path: '/v1/profile', authentication: 'bearer', idempotency: 'required', response: 'Profile' },
  { method: 'GET', path: '/v1/consents', authentication: 'bearer', idempotency: 'not_applicable', response: 'Consent[]' },
  { method: 'PUT', path: '/v1/consents/:type', authentication: 'bearer', idempotency: 'required', response: 'Consent' },
  { method: 'GET', path: '/v1/courses/:id', authentication: 'bearer', idempotency: 'not_applicable', response: 'CourseWithLessonStates' },
  { method: 'GET', path: '/v1/progress', authentication: 'bearer', idempotency: 'not_applicable', response: 'Progress' },
  { method: 'POST', path: '/v1/assessments', authentication: 'bearer', idempotency: 'required', response: 'Assessment' },
  { method: 'POST', path: '/v1/assessments/:id/complete', authentication: 'bearer', idempotency: 'required', response: 'AssessmentCompletion' },
  { method: 'GET', path: '/v1/plans/current', authentication: 'bearer', idempotency: 'not_applicable', response: 'WorkoutPlan' },
  { method: 'POST', path: '/v1/workout-sessions', authentication: 'bearer', idempotency: 'required', response: 'WorkoutSession' },
  { method: 'PUT', path: '/v1/workout-sessions/:id/results', authentication: 'bearer', idempotency: 'required', response: 'WorkoutSession' },
  { method: 'POST', path: '/v1/workout-sessions/:id/complete', authentication: 'bearer', idempotency: 'required', response: 'WorkoutCompletion' },
  { method: 'POST', path: '/v1/sync/batch', authentication: 'bearer', idempotency: 'required', response: 'SyncBatchResult' },
  { method: 'GET', path: '/v1/privacy/export', authentication: 'bearer', idempotency: 'not_applicable', response: 'PrivacyExport' },
  { method: 'DELETE', path: '/v1/privacy/account', authentication: 'bearer', idempotency: 'required', response: 'PrivacyDeletion' },
  { method: 'GET', path: '/v1/foods/barcodes/:barcode', authentication: 'bearer', idempotency: 'not_applicable', response: 'BarcodeNutritionFood (persisted may be false when storage is unavailable)' },
  { method: 'POST', path: '/v1/foods/custom', authentication: 'bearer', idempotency: 'required', response: 'NutritionFood' },
  { method: 'POST', path: '/v1/foods/candidates', authentication: 'bearer', idempotency: 'not_applicable', response: 'NutritionCandidateResponse' },
  { method: 'POST', path: '/v1/foods/candidates/image', authentication: 'bearer', idempotency: 'not_applicable', response: 'NutritionCandidateResponse' },
  { method: 'GET', path: '/v1/food-entries', authentication: 'bearer', idempotency: 'not_applicable', response: 'FoodEntry[]' },
  { method: 'POST', path: '/v1/food-entries', authentication: 'bearer', idempotency: 'required', response: 'FoodEntry' },
  { method: 'PUT', path: '/v1/food-entries/:id', authentication: 'bearer', idempotency: 'required', response: 'FoodEntry' },
  { method: 'DELETE', path: '/v1/food-entries/:id', authentication: 'bearer', idempotency: 'required', response: 'DeletedFoodEntry' },
  { method: 'GET', path: '/v1/nutrition/daily', authentication: 'bearer', idempotency: 'not_applicable', response: 'DailyNutrition' },
] as const satisfies readonly ApiEndpoint[];
