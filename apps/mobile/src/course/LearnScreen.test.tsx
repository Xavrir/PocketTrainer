import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { LearnScreen } from '../screens/LearnScreen';
import type {
  CourseCatalogView,
  CourseLesson,
  CourseLessonState,
} from './types';

function courseLesson(
  state: CourseLessonState,
  launchAllowed: boolean,
): CourseLesson {
  return {
    id: state,
    key: state,
    trackKey: 'strength',
    trackTitle: 'Kekuatan',
    courseId: 'strength-course',
    courseTitle: 'Fondasi kuat',
    unitTitle: 'Dasar',
    title: state,
    description: `${state} lesson`,
    order: 1,
    exerciseKey: 'body_squat',
    exerciseName: 'Squat tubuh',
    exerciseDefinitionId: 'body-squat-definition',
    exerciseDefinition: {
      id: 'body-squat-definition',
      exerciseKey: 'body_squat',
      version: 1,
      scoringVersion: '1.0.0',
      poseModelVersion: 'pose-1',
      name: 'Squat tubuh',
      category: 'strength',
      mode: 'repetition',
      cameraView: 'side',
      contentUrl: null,
    },
    target: { type: 'reps', value: 8, sets: 1 },
    coaching: {
      mode: 'repetition',
      target: { type: 'reps', value: 8, sets: 1 },
      repetitionSource: 'native',
      scoringSupported: true,
      playable: true,
    },
    equipment: [],
    durationMinutes: 5,
    xp: 60,
    access: {
      state,
      launchAllowed,
      reasons: launchAllowed
        ? []
        : [
            {
              code: 'LOCKED',
              message: `${state} cannot launch`,
              currentValue: null,
              requiredValue: null,
            },
          ],
    },
  };
}

const lessons = [
  courseLesson('completed', true),
  courseLesson('available', true),
  courseLesson('gated', false),
  courseLesson('locked', false),
];

const catalog: CourseCatalogView = {
  version: 'test',
  locale: 'id',
  accountLevel: 1,
  exercises: [],
  completedLessonCount: 1,
  totalLessonCount: lessons.length,
  tracks: [
    {
      id: 'strength',
      key: 'strength',
      title: 'Kekuatan',
      description: 'Track test',
      accent: '#ffffff',
      order: 1,
      courses: [
        {
          id: 'course',
          key: 'course',
          title: 'Fondasi kuat',
          description: 'Track test',
          order: 1,
          minimumAccountLevel: 1,
          publishingState: 'published',
          units: [{ id: 'unit', title: 'Dasar', order: 1, lessons }],
        },
      ],
      units: [{ id: 'unit', title: 'Dasar', order: 1, lessons }],
    },
  ],
};

describe('LearnScreen lesson selection', () => {
  it('uses launchAllowed for completed, available, gated, and locked lessons', async () => {
    const onSelect = jest.fn();
    const onStart = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <LearnScreen catalog={catalog} onSelect={onSelect} onStart={onStart} />,
      );
    });

    const lessonRows = Object.fromEntries(
      renderer.root
        .findAll(
          node =>
            typeof node.props.accessibilityLabel === 'string' &&
            typeof node.props.disabled === 'boolean',
        )
        .map(node => [node.props.accessibilityLabel, node]),
    );

    expect(lessonRows['completed, selesai'].props.disabled).toBe(false);
    expect(lessonRows['available, tersedia'].props.disabled).toBe(false);
    expect(
      lessonRows['gated, butuh syarat. gated cannot launch'].props.disabled,
    ).toBe(true);
    expect(
      lessonRows['locked, terkunci. locked cannot launch'].props.disabled,
    ).toBe(true);

    ReactTestRenderer.act(() => {
      lessonRows['completed, selesai'].props.onPress();
      lessonRows['available, tersedia'].props.onPress();
    });

    expect(onSelect.mock.calls.map(([lesson]) => lesson.id)).toEqual([
      'completed',
      'available',
    ]);
    expect(onStart.mock.calls.map(([lesson]) => lesson.id)).toEqual([
      'completed',
      'available',
    ]);
  });
});
