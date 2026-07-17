import { getSupabaseClient } from '../auth/supabase';
import { publicConfig } from '../config/publicConfig';
import type {
  ApiErrorBody,
  Bootstrap,
  Catalog,
  CompleteWorkoutInput,
  Consent,
  ConsentType,
  CreateCustomFoodInput,
  CreateFoodEntryInput,
  CreateWorkoutInput,
  CustomFood,
  DailyNutrition,
  FoodCandidate,
  FoodCandidatesRequest,
  FoodCandidatesResponse,
  FoodImageCandidatesRequest,
  FoodEntry,
  FoodEntryDeletion,
  Profile,
  Progress,
  PrivacyDeletion,
  PrivacyExport,
  NutritionDailyResponse,
  BarcodeNutritionFood,
  NutritionFood,
  NutritionFoodEntry,
  UpdateFoodEntryInput,
  UpdateConsentInput,
  UpdateProfileInput,
  UploadWorkoutResultsInput,
  WorkoutCompletion,
  WorkoutSession,
} from './types';
import {
  mapCreateFoodEntryRequest,
  mapDailyNutrition,
  mapNutritionFood,
  mapNutritionFoodEntry,
  mapUpdateFoodEntryRequest,
} from '../nutrition/data/nutritionMapper';

export class ApiClientError extends Error {
  readonly cause?: unknown;
  readonly code: string;
  readonly details?: unknown;
  readonly recoverable: boolean;
  readonly requestId?: string;
  readonly status: number;

  constructor({
    cause,
    code,
    details,
    message,
    recoverable,
    requestId,
    status,
  }: {
    cause?: unknown;
    code: string;
    details?: unknown;
    message: string;
    recoverable: boolean;
    requestId?: string;
    status: number;
  }) {
    super(message);
    this.name = 'ApiClientError';
    this.cause = cause;
    this.code = code;
    this.details = details;
    this.recoverable = recoverable;
    this.requestId = requestId;
    this.status = status;
    Object.setPrototypeOf(this, ApiClientError.prototype);
  }
}

export type ApiRequestOptions = {
  headers?: RequestInit['headers'];
  signal?: AbortSignal;
};

export type ApiMutationOptions = ApiRequestOptions & {
  idempotencyKey: string;
};

function clientError(
  code: string,
  message: string,
  cause?: unknown,
): ApiClientError {
  return new ApiClientError({
    cause,
    code,
    message,
    recoverable: true,
    status: 0,
  });
}

function requireVersionedPath(path: string): void {
  if (!path.startsWith('/v1/')) {
    throw clientError('INVALID_API_PATH', 'API paths must begin with /v1/.');
  }
}

function requireId(value: string, label: string): string {
  const id = value.trim();
  if (!id) throw clientError('INVALID_REQUEST', `${label} is required.`);
  return encodeURIComponent(id);
}

function requestHeaders(init: RequestInit, accessToken: string): Headers {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (publicConfig.apiBaseUrlError) {
    throw clientError('API_CONFIGURATION_UNSAFE', publicConfig.apiBaseUrlError);
  }
  if (!publicConfig.apiBaseUrl) {
    throw clientError(
      'API_NOT_CONFIGURED',
      'POCKETTRAINER_API_BASE_URL is not configured.',
    );
  }
  requireVersionedPath(path);

  const client = getSupabaseClient();
  if (!client) {
    throw clientError('AUTH_REQUIRED', 'Authentication is required.');
  }

  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    throw clientError('AUTH_REQUIRED', 'Authentication is required.', error);
  }

  const baseUrl = publicConfig.apiBaseUrl.replace(/\/+$/, '');
  const request = (accessToken: string) =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: requestHeaders(init, accessToken),
    });

  const response = await request(data.session.access_token);
  if (response.status !== 401) return response;

  const refreshed = await client.auth.refreshSession();
  if (refreshed.error || !refreshed.data.session) return response;
  return request(refreshed.data.session.access_token);
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new ApiClientError({
      cause,
      code: 'INVALID_RESPONSE',
      message: 'The API returned an invalid JSON response.',
      recoverable: true,
      status: response.status,
    });
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== 'object' || !('error' in value)) return false;
  const error = (value as { error?: unknown }).error;
  return (
    !!error &&
    typeof error === 'object' &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string' &&
    typeof (error as { recoverable?: unknown }).recoverable === 'boolean'
  );
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  allowEmpty = false,
): Promise<T> {
  let response: Response;
  try {
    response = await apiFetch(path, init);
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    throw clientError(
      'NETWORK_ERROR',
      'The API could not be reached. Check the connection and try again.',
      error,
    );
  }

  const body = await readResponseBody(response);
  if (!response.ok) {
    if (isApiErrorBody(body)) {
      throw new ApiClientError({
        code: body.error.code,
        details: body.error.details,
        message: body.error.message,
        recoverable: body.error.recoverable,
        requestId: body.error.requestId,
        status: response.status,
      });
    }
    throw new ApiClientError({
      code: 'HTTP_ERROR',
      details: body,
      message: `The API request failed with status ${response.status}.`,
      recoverable: response.status >= 500,
      status: response.status,
    });
  }

  if (body === undefined && !allowEmpty) {
    throw new ApiClientError({
      code: 'INVALID_RESPONSE',
      message: 'The API returned an empty response.',
      recoverable: true,
      status: response.status,
    });
  }
  return body as T;
}

function requireDate(value: string, label: string): string {
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw clientError('INVALID_REQUEST', `${label} must use YYYY-MM-DD.`);
  }
  return encodeURIComponent(date);
}

function jsonMutation<T>(
  path: string,
  method: 'POST' | 'PUT',
  body: unknown,
  options: ApiMutationOptions,
): Promise<T> {
  const idempotencyKey = options.idempotencyKey.trim();
  if (!idempotencyKey) {
    throw clientError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'An idempotency key is required for mutations.',
    );
  }
  const headers = new Headers(options.headers);
  headers.set('Idempotency-Key', idempotencyKey);
  return apiRequest<T>(path, {
    body: JSON.stringify(body),
    headers,
    method,
    signal: options.signal,
  });
}

export function getBootstrap(
  options: ApiRequestOptions = {},
): Promise<Bootstrap> {
  return apiRequest<Bootstrap>('/v1/bootstrap', options);
}

export function getCatalog(options: ApiRequestOptions = {}): Promise<Catalog> {
  return apiRequest<Catalog>('/v1/catalog', options);
}

export function getProfile(options: ApiRequestOptions = {}): Promise<Profile> {
  return apiRequest<Profile>('/v1/profile', options);
}

export function updateProfile(
  input: UpdateProfileInput,
  options: ApiMutationOptions,
): Promise<Profile> {
  return jsonMutation<Profile>('/v1/profile', 'PUT', input, options);
}

export function updateConsent(
  type: ConsentType,
  input: UpdateConsentInput,
  options: ApiMutationOptions,
): Promise<Consent> {
  return jsonMutation<Consent>(
    `/v1/consents/${requireId(type, 'Consent type')}`,
    'PUT',
    input,
    options,
  );
}

export function createWorkoutSession(
  input: CreateWorkoutInput,
  options: ApiMutationOptions,
): Promise<WorkoutSession> {
  return jsonMutation<WorkoutSession>(
    '/v1/workout-sessions',
    'POST',
    input,
    options,
  );
}

export function uploadWorkoutResults(
  workoutSessionId: string,
  input: UploadWorkoutResultsInput,
  options: ApiMutationOptions,
): Promise<WorkoutSession> {
  return jsonMutation<WorkoutSession>(
    `/v1/workout-sessions/${requireId(
      workoutSessionId,
      'Workout session ID',
    )}/results`,
    'PUT',
    input,
    options,
  );
}

export function completeWorkoutSession(
  workoutSessionId: string,
  input: CompleteWorkoutInput,
  options: ApiMutationOptions,
): Promise<WorkoutCompletion> {
  return jsonMutation<WorkoutCompletion>(
    `/v1/workout-sessions/${requireId(
      workoutSessionId,
      'Workout session ID',
    )}/complete`,
    'POST',
    input,
    options,
  );
}

export function getProgress(
  options: ApiRequestOptions = {},
): Promise<Progress> {
  return apiRequest<Progress>('/v1/progress', options);
}

export function lookupBarcode(
  barcode: string,
  options: ApiRequestOptions = {},
): Promise<FoodCandidate | null> {
  return apiRequest<BarcodeNutritionFood | null>(
    `/v1/foods/barcodes/${requireId(barcode, 'Barcode')}`,
    options,
  ).then(food => (food ? mapNutritionFood(food) : null));
}

export const lookupFoodByBarcode = lookupBarcode;

export function createCustomFood(
  input: CreateCustomFoodInput,
  options: ApiMutationOptions,
): Promise<CustomFood> {
  return jsonMutation<NutritionFood>(
    '/v1/foods/custom',
    'POST',
    input,
    options,
  ).then(food => ({
    ...mapNutritionFood(food),
    id: food.id,
    persisted: true as const,
    createdAt: food.createdAt,
    source: 'custom' as const,
    updatedAt: food.updatedAt,
  }));
}

export function getFoodEntries(
  date?: string,
  options: ApiRequestOptions = {},
): Promise<FoodEntry[]> {
  const query = date ? `?date=${requireDate(date, 'Nutrition date')}` : '';
  return apiRequest<NutritionFoodEntry[]>(
    `/v1/food-entries${query}`,
    options,
  ).then(entries => entries.map(mapNutritionFoodEntry));
}

export function getFoodEntry(
  foodEntryId: string,
  options: ApiRequestOptions = {},
): Promise<FoodEntry> {
  return apiRequest<NutritionFoodEntry>(
    `/v1/food-entries/${requireId(foodEntryId, 'Food entry ID')}`,
    options,
  ).then(mapNutritionFoodEntry);
}

export function createFoodEntry(
  input: CreateFoodEntryInput,
  options: ApiMutationOptions,
): Promise<FoodEntry> {
  return jsonMutation<NutritionFoodEntry>(
    '/v1/food-entries',
    'POST',
    mapCreateFoodEntryRequest(input),
    options,
  ).then(mapNutritionFoodEntry);
}

export function updateFoodEntry(
  foodEntryId: string,
  input: UpdateFoodEntryInput,
  options: ApiMutationOptions,
): Promise<FoodEntry> {
  return jsonMutation<NutritionFoodEntry>(
    `/v1/food-entries/${requireId(foodEntryId, 'Food entry ID')}`,
    'PUT',
    mapUpdateFoodEntryRequest(input),
    options,
  ).then(mapNutritionFoodEntry);
}

export function deleteFoodEntry(
  foodEntryId: string,
  options: ApiMutationOptions,
): Promise<FoodEntryDeletion> {
  const idempotencyKey = options.idempotencyKey.trim();
  if (!idempotencyKey) {
    throw clientError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'An idempotency key is required for mutations.',
    );
  }
  const headers = new Headers(options.headers);
  headers.set('Idempotency-Key', idempotencyKey);
  return apiRequest<FoodEntryDeletion>(
    `/v1/food-entries/${requireId(foodEntryId, 'Food entry ID')}`,
    { headers, method: 'DELETE', signal: options.signal },
  );
}

export function getDailyNutrition(
  date: string,
  options: ApiRequestOptions = {},
): Promise<DailyNutrition> {
  return apiRequest<NutritionDailyResponse>(
    `/v1/nutrition/daily?date=${requireDate(date, 'Nutrition date')}`,
    options,
  ).then(mapDailyNutrition);
}

export const getDailyNutritionSummary = getDailyNutrition;

export function generateFoodCandidates(
  input: FoodCandidatesRequest,
  options: ApiRequestOptions = {},
): Promise<FoodCandidatesResponse> {
  const label = input.label.trim();
  if (label.length < 2) {
    throw clientError(
      'INVALID_REQUEST',
      'A food label with at least two characters is required.',
    );
  }
  const barcode = input.barcode?.trim();
  const body: FoodCandidatesRequest = barcode ? { label, barcode } : { label };
  return apiRequest<FoodCandidatesResponse>('/v1/foods/candidates', {
    body: JSON.stringify(body),
    headers: options.headers,
    method: 'POST',
    signal: options.signal,
  });
}

export function generateFoodCandidatesFromImage(
  input: FoodImageCandidatesRequest,
  options: ApiRequestOptions = {},
): Promise<FoodCandidatesResponse> {
  const imageBase64 = input.imageBase64.trim();
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(imageBase64) || imageBase64.length > 900_000) {
    throw clientError(
      'INVALID_REQUEST',
      'The selected food image is invalid or too large to review.',
    );
  }
  const label = input.label?.trim();
  return apiRequest<FoodCandidatesResponse>('/v1/foods/candidates/image', {
    body: JSON.stringify({
      imageBase64,
      label: label || undefined,
      mimeType: input.mimeType,
    }),
    headers: options.headers,
    method: 'POST',
    signal: options.signal,
  });
}

export function getPrivacyExport(
  options: ApiRequestOptions = {},
): Promise<PrivacyExport> {
  return apiRequest<PrivacyExport>('/v1/privacy/export', options);
}

export function deleteAccount(
  options: ApiMutationOptions,
): Promise<PrivacyDeletion> {
  const idempotencyKey = options.idempotencyKey.trim();
  if (!/^[A-Za-z0-9:_-]{8,200}$/.test(idempotencyKey)) {
    throw clientError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'A valid idempotency key is required for account deletion.',
    );
  }
  const headers = new Headers(options.headers);
  headers.set('Idempotency-Key', idempotencyKey);
  return apiRequest<PrivacyDeletion>('/v1/privacy/account', {
    headers,
    method: 'DELETE',
    signal: options.signal,
  });
}

export const pocketTrainerApi = {
  completeWorkoutSession,
  createCustomFood,
  createFoodEntry,
  createWorkoutSession,
  deleteFoodEntry,
  getDailyNutrition,
  getFoodEntries,
  getFoodEntry,
  getBootstrap,
  getCatalog,
  getProfile,
  getProgress,
  getPrivacyExport,
  generateFoodCandidates,
  generateFoodCandidatesFromImage,
  lookupBarcode,
  lookupFoodByBarcode,
  deleteAccount,
  updateFoodEntry,
  updateConsent,
  updateProfile,
  uploadWorkoutResults,
} as const;
