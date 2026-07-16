import { adaptCourseCatalog } from './catalogAdapter';

const localized = (value: string) => ({ id: value, en: value });

function lesson(
  id: string,
  exerciseDefinitionId: string,
  requirements: Readonly<{
    minimumLevel?: number;
    prerequisiteLessonIds?: readonly string[];
    requiredMasteryKeys?: readonly string[];
    requiredEquipment?: readonly string[];
  }> = {},
) {
  return {
    id,
    exerciseDefinitionId,
    title: localized(id),
    summary: localized(`Ringkasan ${id}`),
    order: 1,
    target: { type: 'reps', value: 8 },
    xpReward: 60,
    requirements: {
      minimumLevel: requirements.minimumLevel ?? 1,
      prerequisiteLessonIds: requirements.prerequisiteLessonIds ?? [],
      requiredMasteryKeys: requirements.requiredMasteryKeys ?? [],
      requiredEquipment: requirements.requiredEquipment ?? [],
    },
  };
}

describe('adaptCourseCatalog', () => {
  it('shows all seeded tracks and lessons while preserving mastery and level gates', () => {
    const squat = lesson('squat', 'body-squat');
    const squatControl = lesson('squat-control', 'body-squat', {
      minimumLevel: 2,
      prerequisiteLessonIds: ['squat'],
      requiredMasteryKeys: ['body_squat'],
    });
    const pushup = lesson('pushup', 'pushup', {
      requiredEquipment: ['bench_or_wall'],
    });
    const warrior = lesson('warrior', 'warrior');
    const tree = lesson('tree', 'tree', {
      minimumLevel: 2,
      prerequisiteLessonIds: ['warrior'],
      requiredMasteryKeys: ['warrior_two'],
    });
    const mobility = lesson('mobility', 'warrior');

    const catalog = adaptCourseCatalog({
      catalog: {
        version: 1,
        exercises: [
          {
            id: 'body-squat',
            exerciseKey: 'body_squat',
            version: 1,
            scoringVersion: '1.0.0',
            poseModelVersion: 'pose-1',
            mode: 'repetition',
            cameraView: 'side',
            name: localized('Squat tubuh'),
          },
          {
            id: 'pushup',
            exerciseKey: 'incline_push_up',
            mode: 'repetition',
            name: localized('Push-up miring'),
          },
          {
            id: 'warrior',
            exerciseKey: 'warrior_two',
            mode: 'hold',
            cameraView: 'front',
            name: localized('Warrior II'),
          },
          {
            id: 'tree',
            exerciseKey: 'tree_pose',
            name: localized('Pose pohon'),
          },
        ],
        tracks: [
          {
            id: 'strength',
            slug: 'strength',
            title: localized('Kekuatan'),
            courses: [
              {
                id: 'strength-course',
                title: localized('Fondasi kuat'),
                units: [
                  {
                    id: 'strength-unit',
                    title: localized('Kaki stabil'),
                    lessons: [squat, squatControl, pushup],
                  },
                ],
              },
            ],
          },
          {
            id: 'yoga',
            slug: 'yoga',
            title: localized('Yoga'),
            courses: [
              {
                id: 'yoga-course',
                title: localized('Aliran dasar'),
                units: [
                  {
                    id: 'yoga-unit',
                    title: localized('Keseimbangan'),
                    lessons: [warrior, tree],
                  },
                ],
              },
            ],
          },
          {
            id: 'mobility',
            slug: 'mobility',
            title: localized('Mobilitas'),
            courses: [
              {
                id: 'mobility-course',
                title: localized('Reset harian'),
                units: [
                  {
                    id: 'mobility-unit',
                    title: localized('Mulai bergerak'),
                    lessons: [mobility],
                  },
                ],
              },
            ],
          },
        ],
      },
      profile: { equipment: [] },
      progress: {
        xp: { level: 1 },
        completedLessonIds: [],
        mastery: [],
      },
    });

    expect(catalog.tracks.map(track => track.key)).toEqual([
      'strength',
      'yoga',
      'mobility',
    ]);
    expect(catalog.totalLessonCount).toBe(6);
    expect(catalog.locale).toBe('id');
    expect(catalog.tracks[0]?.courses[0]?.units).toHaveLength(1);

    const lessons = catalog.tracks.flatMap(track =>
      track.units.flatMap(unit => unit.lessons),
    );
    const harderSquat = lessons.find(item => item.id === 'squat-control');
    expect(harderSquat?.access.state).toBe('locked');
    expect(harderSquat?.access.reasons.map(reason => reason.code)).toEqual(
      expect.arrayContaining([
        'ACCOUNT_LEVEL_REQUIRED',
        'PREREQUISITE_LESSON_REQUIRED',
        'MASTERY_REQUIRED',
      ]),
    );
    expect(lessons.find(item => item.id === 'squat')?.access.state).toBe(
      'available',
    );
    expect(lessons.find(item => item.id === 'pushup')?.access.state).toBe(
      'gated',
    );
    expect(lessons.find(item => item.id === 'pushup')?.coaching).toMatchObject({
      mode: 'repetition',
      scoringSupported: true,
      playable: true,
    });
    expect(
      lessons.find(item => item.id === 'squat')?.exerciseDefinition,
    ).toMatchObject({
      exerciseKey: 'body_squat',
      mode: 'repetition',
    });
    expect(lessons.find(item => item.id === 'squat')?.coaching).toMatchObject({
      mode: 'repetition',
      scoringSupported: true,
      playable: true,
    });
    expect(lessons.find(item => item.id === 'warrior')?.coaching.mode).toBe(
      'hold',
    );
    expect(lessons.find(item => item.id === 'warrior')?.coaching.scoringSupported).toBe(
      true,
    );
  });

  it('mirrors the native supported movement set and keeps unknown definitions guided', () => {
    const supported = [
      ['body_squat', 'repetition'],
      ['incline_push_up', 'repetition'],
      ['warrior_ii', 'hold'],
      ['tree_pose', 'hold'],
      ['jumping_jack', 'repetition'],
    ] as const;
    const exercises = supported.map(([exerciseKey, mode]) => ({
      id: exerciseKey,
      exerciseKey,
      mode,
    }));
    const lessons = [
      ...supported.map(([exerciseKey]) => lesson(exerciseKey, exerciseKey)),
      lesson('unsupported', 'unsupported_pose'),
      lesson('missing-definition', 'missing-definition'),
    ];
    const catalog = adaptCourseCatalog({
      catalog: {
        version: 1,
        exercises: [
          ...exercises,
          {
            id: 'unsupported_pose',
            exerciseKey: 'unsupported_pose',
            mode: 'repetition',
          },
        ],
        tracks: [
          {
            id: 'strength',
            slug: 'strength',
            title: localized('Kekuatan'),
            courses: [
              {
                id: 'course',
                title: localized('Fondasi'),
                units: [{
                  id: 'unit',
                  title: localized('Dasar'),
                  lessons,
                }],
              },
            ],
          },
        ],
      },
      progress: { xp: { level: 1 }, completedLessonIds: [] },
    });

    const adapted = catalog.tracks[0]!.units[0]!.lessons;
    for (const [exerciseKey] of supported) {
      expect(adapted.find(item => item.id === exerciseKey)?.coaching.scoringSupported).toBe(
        true,
      );
    }
    expect(
      adapted.find(item => item.id === 'unsupported')?.coaching,
    ).toMatchObject({ scoringSupported: false, playable: true });
    expect(
      adapted.find(item => item.id === 'missing-definition')?.coaching,
    ).toMatchObject({ scoringSupported: false, playable: false });
  });

  it('keeps server launchAllowed authoritative and gives legacy states an explicit reason', () => {
    const catalog = adaptCourseCatalog({
      catalog: {
        version: 1,
        exercises: [
          { id: 'definition', exerciseKey: 'body_squat', mode: 'repetition' },
        ],
        tracks: [
          {
            id: 'strength',
            slug: 'strength',
            title: localized('Kekuatan'),
            courses: [
              {
                id: 'course',
                title: localized('Fondasi'),
                units: [
                  {
                    id: 'unit',
                    title: localized('Dasar'),
                    lessons: [lesson('locked-lesson', 'definition')],
                  },
                ],
              },
            ],
          },
        ],
      },
      lessonAccess: { 'locked-lesson': 'locked_level' },
      progress: { xp: { level: 99 }, completedLessonIds: ['locked-lesson'] },
    });

    const locked = catalog.tracks[0]!.units[0]!.lessons[0]!;
    expect(locked.access.state).toBe('gated');
    expect(locked.access.launchAllowed).toBe(false);
    expect(locked.access.reasons).toEqual([
      expect.objectContaining({ code: 'ACCOUNT_LEVEL_REQUIRED' }),
    ]);
  });

  it('can select English catalog resources without losing the Indonesian fallback', () => {
    const catalog = adaptCourseCatalog(
      {
        catalog: {
          version: 1,
          exercises: [
            {
              id: 'definition',
              exerciseKey: 'body_squat',
              mode: 'repetition',
              name: { id: 'Squat tubuh', en: 'Body squat' },
            },
          ],
          tracks: [
            {
              id: 'strength',
              slug: 'strength',
              title: { id: 'Kekuatan', en: 'Strength' },
              courses: [
                {
                  id: 'course',
                  title: { id: 'Fondasi', en: 'Foundations' },
                  units: [
                    {
                      id: 'unit',
                      title: { id: 'Dasar', en: 'Basics' },
                      lessons: [
                        {
                          ...lesson('lesson', 'definition'),
                          title: { id: 'Pelajaran', en: 'Lesson' },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        progress: { xp: { level: 1 }, completedLessonIds: [] },
      },
      { locale: 'en' },
    );

    expect(catalog.locale).toBe('en');
    expect(catalog.tracks[0]?.title).toBe('Strength');
    expect(catalog.tracks[0]?.courses[0]?.title).toBe('Foundations');
    expect(catalog.tracks[0]?.units[0]?.lessons[0]?.title).toBe('Lesson');
  });
});
