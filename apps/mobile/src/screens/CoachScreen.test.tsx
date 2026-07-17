import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { PrimaryButton } from '../components/PrimaryButton';
import type { CourseLesson } from '../course/types';
import { CoachScreen } from './CoachScreen';

const squatLesson: CourseLesson = {
  id: 'lesson-squat',
  key: 'squat-foundation',
  trackKey: 'strength',
  trackTitle: 'Strength',
  courseId: 'course-strength',
  courseTitle: 'Strength Foundations',
  unitTitle: 'Foundation',
  title: 'Squat foundation',
  description: 'Bangun kontrol kaki dengan tiga repetisi nyaman.',
  order: 1,
  exerciseKey: 'body_squat',
  exerciseName: 'Body squat',
  exerciseDefinitionId: 'exercise-squat',
  exerciseDefinition: null,
  target: { type: 'reps', value: 3, sets: 1 },
  coaching: {
    mode: 'repetition',
    target: { type: 'reps', value: 3, sets: 1 },
    repetitionSource: 'native',
    scoringSupported: true,
    playable: true,
  },
  equipment: [],
  durationMinutes: 4,
  xp: 30,
  access: { state: 'available', launchAllowed: true, reasons: [] },
};

const plan = {
  id: 'plan-1',
  revision: 1,
  status: 'active' as const,
  generatedAt: '2026-07-17T00:00:00.000Z',
  reason: { id: 'Fondasi berdasarkan asesmen squat.', en: 'Foundation.' },
  lessonIds: [squatLesson.id],
};

async function render(
  props: Partial<React.ComponentProps<typeof CoachScreen>> = {},
) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <CoachScreen onAssessment={jest.fn()} onWorkout={jest.fn()} {...props} />,
    );
  });
  return renderer;
}

describe('CoachScreen truthful recommendation states', () => {
  it('shows explicit loading instead of a hardcoded recommendation', async () => {
    const renderer = await render({ loading: true });
    const text = renderer.root
      .findAllByType('Text' as never)
      .map(node => node.props.children)
      .flat(Infinity)
      .join(' ');

    expect(text).toContain('Memuat rencana server…');
    expect(text).not.toContain('Kuasai squat-mu.');
  });

  it('renders the server-mapped lesson target, duration, and equipment', async () => {
    const onWorkout = jest.fn();
    const renderer = await render({
      currentPlan: plan,
      recommendedLesson: squatLesson,
      onWorkout,
    });
    const text = renderer.root
      .findAllByType('Text' as never)
      .map(node => node.props.children)
      .flat(Infinity)
      .join(' ');

    expect(text).toContain('Squat foundation');
    expect(text).toContain('3 repetisi');
    expect(text).toContain('4 menit');
    expect(text).toContain('Tanpa alat');

    const start = renderer.root
      .findAllByType(PrimaryButton)
      .find(node => node.props.label === 'Mulai coaching squat');
    ReactTestRenderer.act(() => start?.props.onPress());
    expect(onWorkout).toHaveBeenCalledWith(squatLesson);
  });

  it('labels unsupported movements as guided and never claims a form score', async () => {
    const renderer = await render({
      currentPlan: plan,
      recommendedLesson: {
        ...squatLesson,
        id: 'lesson-tree',
        title: 'Tree Pose',
        exerciseKey: 'tree_pose',
        coaching: {
          ...squatLesson.coaching,
          scoringSupported: false,
          repetitionSource: 'user_confirmed',
        },
      },
    });
    const text = renderer.root
      .findAllByType('Text' as never)
      .map(node => node.props.children)
      .flat(Infinity)
      .join(' ');

    expect(text).toContain(
      'Praktik terpandu — tanpa skor form, mastery, atau unlock.',
    );
    expect(text).not.toMatch(/skor form:\s*\d/i);
    expect(
      renderer.root
        .findAllByType(PrimaryButton)
        .some(node => node.props.label === 'Mulai praktik terpandu'),
    ).toBe(true);
  });

  it('routes the empty-plan primary action to assessment', async () => {
    const onAssessment = jest.fn();
    const renderer = await render({ currentPlan: null, onAssessment });
    const button = renderer.root
      .findAllByType(PrimaryButton)
      .find(node => node.props.label === 'Mulai asesmen 3 repetisi');

    ReactTestRenderer.act(() => button?.props.onPress());
    expect(onAssessment).toHaveBeenCalledTimes(1);
  });

  it('does not advertise a gated recommendation as launchable', async () => {
    const renderer = await render({
      currentPlan: plan,
      recommendedLesson: {
        ...squatLesson,
        access: {
          state: 'gated',
          launchAllowed: false,
          reasons: [
            {
              code: 'MASTERY_REQUIRED',
              message: 'Mastery is required.',
              currentValue: 70,
              requiredValue: 80,
            },
          ],
        },
      },
    });
    const button = renderer.root
      .findAllByType(PrimaryButton)
      .find(node => node.props.label === 'Lesson belum dapat diluncurkan');

    expect(button?.props.disabled).toBe(true);
  });
});
