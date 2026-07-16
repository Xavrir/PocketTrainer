/** @format */

jest.mock('../src/api/apiClient', () => ({
  completeWorkoutSession: jest.fn(),
  createWorkoutSession: jest.fn(),
  updateConsent: jest.fn(),
  updateProfile: jest.fn(),
  uploadWorkoutResults: jest.fn(),
}));

import {
  completeWorkoutSession,
  createWorkoutSession,
  updateConsent,
  updateProfile,
  uploadWorkoutResults,
} from '../src/api/apiClient';
import { completeWorkoutFlow, persistOnboarding } from '../src/api/workflows';

const mockedCompleteWorkoutSession = jest.mocked(completeWorkoutSession);
const mockedCreateWorkoutSession = jest.mocked(createWorkoutSession);
const mockedUpdateConsent = jest.mocked(updateConsent);
const mockedUpdateProfile = jest.mocked(updateProfile);
const mockedUploadWorkoutResults = jest.mocked(uploadWorkoutResults);

describe('API workflows', () => {
  beforeEach(() => jest.clearAllMocks());

  it('persists consent before marking onboarding complete in the profile', async () => {
    mockedUpdateConsent.mockResolvedValue({
      type: 'privacy',
      granted: true,
      version: '1.0',
      updatedAt: '2026-07-16T00:00:00.000Z',
    });
    mockedUpdateProfile.mockResolvedValue({
      displayName: 'Ayu',
      locale: 'id',
      timezone: 'Asia/Jakarta',
      primaryGoal: 'build_strength',
      experienceLevel: 'foundation',
      equipment: ['chair'],
      limitations: [],
      schedule: { days: ['monday'], durationMinutes: 30 },
      onboardingCompleted: true,
      updatedAt: '2026-07-16T00:00:00.000Z',
    });

    await persistOnboarding({
      consents: [
        {
          idempotencyKey: 'consent-key',
          input: { granted: true, version: '1.0' },
          type: 'privacy',
        },
      ],
      profile: {
        displayName: 'Ayu',
        locale: 'id',
        timezone: 'Asia/Jakarta',
        primaryGoal: 'build_strength',
        experienceLevel: 'foundation',
        equipment: ['chair'],
        limitations: [],
        schedule: { days: ['monday'], durationMinutes: 30 },
        onboardingCompleted: true,
      },
      profileIdempotencyKey: 'profile-key',
    });

    expect(mockedUpdateConsent).toHaveBeenCalledWith(
      'privacy',
      { granted: true, version: '1.0' },
      { idempotencyKey: 'consent-key' },
    );
    expect(mockedUpdateConsent.mock.invocationCallOrder[0]).toBeLessThan(
      mockedUpdateProfile.mock.invocationCallOrder[0]!,
    );
  });

  it('runs the idempotent create, result upload, and completion sequence', async () => {
    const session = {
      id: 'session-id',
      lessonId: 'lesson-id',
      status: 'in_progress' as const,
      startedAt: '2026-07-16T00:00:00.000Z',
      results: [],
    };
    mockedCreateWorkoutSession.mockResolvedValue(session);
    mockedUploadWorkoutResults.mockResolvedValue(session);
    mockedCompleteWorkoutSession.mockResolvedValue({
      xpAwarded: 80,
      xpCapped: false,
      totalXp: 80,
      level: 1,
      masteryChanges: [],
      newlyUnlockedLessonIds: [],
      planRevision: 1,
      progressionSuppressed: false,
    });

    const result = await completeWorkoutFlow({
      completion: {
        completedAt: '2026-07-16T00:01:00.000Z',
        perceivedDifficulty: 5,
        painReported: false,
      },
      completionIdempotencyKey: 'completion-key',
      create: {
        lessonId: 'lesson-id',
        startedAt: '2026-07-16T00:00:00.000Z',
        applicationVersion: '0.2.0',
      },
      createIdempotencyKey: 'create-key',
      results: { results: [] },
      resultsIdempotencyKey: 'results-key',
    });

    expect(result.completion.xpAwarded).toBe(80);
    expect(mockedUploadWorkoutResults).toHaveBeenCalledWith(
      'session-id',
      { results: [] },
      { idempotencyKey: 'results-key' },
    );
    expect(mockedCompleteWorkoutSession).toHaveBeenCalledWith(
      'session-id',
      expect.objectContaining({ painReported: false }),
      { idempotencyKey: 'completion-key' },
    );
    expect(mockedCreateWorkoutSession.mock.invocationCallOrder[0]).toBeLessThan(
      mockedUploadWorkoutResults.mock.invocationCallOrder[0]!,
    );
    expect(mockedUploadWorkoutResults.mock.invocationCallOrder[0]).toBeLessThan(
      mockedCompleteWorkoutSession.mock.invocationCallOrder[0]!,
    );
  });
});
