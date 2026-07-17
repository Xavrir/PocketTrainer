import { sharePrivacyExport } from './sharePrivacyExport';

describe('sharePrivacyExport', () => {
  it('opens the native share action with formatted JSON', async () => {
    const share = jest.fn().mockResolvedValue({ action: 'sharedAction' });
    const data = {
      formatVersion: 1 as const,
      generatedAt: '2026-07-17T10:00:00.000Z',
      user: { id: 'user-1', authSubject: 'auth-1' },
      profile: null,
      consents: [],
      assessments: [],
      currentPlan: null,
      progress: {
        xp: {
          total: 0,
          today: 0,
          dailyCap: 100,
          level: 1,
          currentLevelXp: 0,
          nextLevelXp: 100,
        },
        streak: { current: 0, longest: 0, todayStatus: 'open' as const },
        completedLessonIds: [],
        mastery: [],
        achievements: [],
      },
      workouts: [],
      manifest: { includes: [], excludes: [] },
    };

    await sharePrivacyExport(data, share);

    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        message: JSON.stringify(data, null, 2),
        title: expect.stringContaining('.json'),
      }),
      expect.objectContaining({ dialogTitle: expect.any(String) }),
    );
  });
});
