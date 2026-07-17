/** @format */

const mockGetSession = jest.fn();
const mockRefreshSession = jest.fn();
const mockFetch = jest.fn();

jest.mock('../src/config/publicConfig', () => ({
  publicConfig: {
    allowAuthBypass: false,
    apiBaseUrl: 'https://api.pockettrainer.test/',
    supabasePublishableKey: 'sb_publishable_test',
    supabaseUrl: 'https://test.supabase.co',
  },
}));

jest.mock('../src/auth/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: mockGetSession,
      refreshSession: mockRefreshSession,
    },
  }),
}));

import {
  ApiClientError,
  apiFetch,
  getCatalog,
  generateFoodCandidatesFromImage,
  getProgress,
  updateProfile,
  uploadWorkoutResults,
} from '../src/api/apiClient';

function response(body: unknown, status = 200, rawBody?: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest
      .fn()
      .mockResolvedValue(
        rawBody ?? (body === undefined ? '' : JSON.stringify(body)),
      ),
  } as unknown as Response;
}

describe('PocketTrainer API client', () => {
  beforeEach(() => {
    mockGetSession.mockReset().mockResolvedValue({
      data: { session: { access_token: 'access-one' } },
      error: null,
    });
    mockRefreshSession.mockReset();
    mockFetch.mockReset();
    globalThis.fetch = mockFetch;
  });

  it('sends the Supabase access token without leaking it into the URL', async () => {
    mockFetch.mockResolvedValue(response({ serverTime: 'now' }));

    await apiFetch('/v1/bootstrap');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.pockettrainer.test/v1/bootstrap');
    expect((init.headers as Headers).get('Authorization')).toBe(
      'Bearer access-one',
    );
    expect(String(url)).not.toContain('access-one');
  });

  it('refreshes once after a 401 and retries with the new token', async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: { access_token: 'fresh-token' } },
      error: null,
    });
    mockFetch
      .mockResolvedValueOnce(response({ error: {} }, 401))
      .mockResolvedValueOnce(response({ xp: {} }));

    const result = await getProgress();

    expect(result).toEqual({ xp: {} });
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const retryHeaders = mockFetch.mock.calls[1][1].headers as Headers;
    expect(retryHeaders.get('Authorization')).toBe('Bearer fresh-token');
  });

  it('parses typed JSON responses', async () => {
    const catalog = {
      version: 1,
      publishedAt: '2026-07-16T00:00:00.000Z',
      contentBaseUrl: 'https://content.pockettrainer.test',
      exercises: [],
      tracks: [],
    };
    mockFetch.mockResolvedValue(response(catalog));

    await expect(getCatalog()).resolves.toEqual(catalog);
  });

  it('serializes mutations and preserves required idempotency headers', async () => {
    const profile = {
      displayName: 'Ayu',
      locale: 'id' as const,
      timezone: 'Asia/Jakarta',
      primaryGoal: 'build_strength' as const,
      experienceLevel: 'foundation' as const,
      equipment: ['chair'],
      limitations: [],
      schedule: { days: ['monday' as const], durationMinutes: 30 },
      onboardingCompleted: true,
    };
    mockFetch.mockResolvedValue(
      response({ ...profile, updatedAt: '2026-07-16T00:00:00.000Z' }),
    );

    await updateProfile(profile, { idempotencyKey: 'profile-request-1' });

    const [url, init] = mockFetch.mock.calls[0];
    const headers = init.headers as Headers;
    expect(url).toBe('https://api.pockettrainer.test/v1/profile');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual(profile);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Idempotency-Key')).toBe('profile-request-1');
  });

  it('encodes route identifiers for result uploads', async () => {
    mockFetch.mockResolvedValue(
      response({
        id: 'session-id',
        lessonId: 'lesson-id',
        status: 'in_progress',
        startedAt: '2026-07-16T00:00:00.000Z',
        results: [],
      }),
    );

    await uploadWorkoutResults(
      'session/with unsafe path',
      { results: [] },
      { idempotencyKey: 'results-request-1' },
    );

    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://api.pockettrainer.test/v1/workout-sessions/session%2Fwith%20unsafe%20path/results',
    );
  });

  it('sends bounded image candidates through the authenticated API', async () => {
    mockFetch.mockResolvedValue(
      response({ candidates: [], warning: 'Review only.' }),
    );

    await generateFoodCandidatesFromImage({
      imageBase64: 'aGVsbG8=',
      label: 'Example package',
      mimeType: 'image/jpeg',
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      'https://api.pockettrainer.test/v1/foods/candidates/image',
    );
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      imageBase64: 'aGVsbG8=',
      label: 'Example package',
      mimeType: 'image/jpeg',
    });
  });

  it('surfaces structured API errors with request metadata', async () => {
    mockFetch.mockResolvedValue(
      response(
        {
          error: {
            code: 'IDEMPOTENCY_KEY_REUSED',
            message: 'The key was already used.',
            recoverable: false,
            requestId: 'request-123',
            details: { operation: 'profile.update' },
          },
        },
        409,
      ),
    );

    await expect(getProgress()).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED',
      details: { operation: 'profile.update' },
      message: 'The key was already used.',
      recoverable: false,
      requestId: 'request-123',
      status: 409,
    });
  });

  it('rejects malformed success responses', async () => {
    mockFetch.mockResolvedValue(response(undefined, 200, '<html>bad</html>'));

    await expect(getProgress()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 200,
    });
  });

  it('normalizes network failures without exposing request credentials', async () => {
    mockFetch.mockRejectedValue(new TypeError('socket closed'));

    await expect(getProgress()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      recoverable: true,
      status: 0,
    });
  });

  it('rejects non-versioned paths before making a request', async () => {
    await expect(apiFetch('https://attacker.test/')).rejects.toMatchObject({
      code: 'INVALID_API_PATH',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fails closed when there is no authenticated session', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(apiFetch('/v1/bootstrap')).rejects.toEqual(
      expect.objectContaining<Partial<ApiClientError>>({
        code: 'AUTH_REQUIRED',
      }),
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
