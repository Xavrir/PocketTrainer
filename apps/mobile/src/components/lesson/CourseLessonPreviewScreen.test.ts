import { resolveLessonSupportMode } from './CourseLessonPreviewScreen';
import type { CourseLesson } from '../../course/types';

function lesson(
  overrides: Partial<CourseLesson['coaching']> = {},
): CourseLesson {
  const coaching: CourseLesson['coaching'] = {
    mode: 'repetition',
    target: { type: 'reps', value: 8, sets: 1 },
    repetitionSource: 'user_confirmed',
    scoringSupported: false,
    playable: true,
    ...overrides,
  };
  return {
    id: 'lesson',
    key: 'lesson',
    trackKey: 'strength',
    trackTitle: 'Kekuatan',
    courseId: 'course',
    courseTitle: 'Fondasi',
    unitTitle: 'Dasar',
    title: 'Pelajaran',
    description: 'Deskripsi',
    order: 1,
    exerciseKey: 'incline_push_up',
    exerciseName: 'Push-up miring',
    exerciseDefinitionId: 'definition',
    exerciseDefinition: null,
    target: coaching.target,
    coaching,
    equipment: [],
    durationMinutes: 5,
    xp: 10,
    access: { state: 'available', launchAllowed: true, reasons: [] },
  };
}

describe('resolveLessonSupportMode', () => {
  it('does not claim posture scoring when the definition is guided-only', () => {
    expect(resolveLessonSupportMode(lesson(), 'posture-scored')).toBe('guided');
  });

  it('does not make a lesson playable when its target/definition is incomplete', () => {
    expect(
      resolveLessonSupportMode(lesson({ playable: false }), 'guided'),
    ).toBe('unavailable');
  });

  it('keeps hold lessons in guided mode when they have no scoring support', () => {
    expect(
      resolveLessonSupportMode(
        lesson({
          mode: 'hold',
          target: { type: 'seconds', value: 20, sets: 1 },
        }),
        'guided',
      ),
    ).toBe('guided');
  });
});
