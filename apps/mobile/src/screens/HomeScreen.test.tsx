import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import type { CourseLesson } from '../course/types';
import { HomeScreen } from './HomeScreen';

function renderedText(renderer: ReactTestRenderer.ReactTestRenderer): string {
  return renderer.root
    .findAllByType(Text)
    .flatMap(node => React.Children.toArray(node.props.children))
    .filter((value): value is string | number =>
      ['string', 'number'].includes(typeof value),
    )
    .join(' ');
}

const lesson: CourseLesson = {
  id: 'lesson-squat-1',
  key: 'squat-foundation',
  trackKey: 'strength',
  trackTitle: 'Strength',
  courseId: 'course-strength',
  courseTitle: 'Strength Foundations',
  unitTitle: 'Fondasi',
  title: 'Squat Dasar',
  description: 'Bangun kontrol squat.',
  order: 1,
  exerciseKey: 'body_squat',
  exerciseName: 'Body squat',
  exerciseDefinitionId: 'body-squat-v1',
  exerciseDefinition: null,
  target: { type: 'reps', value: 8, sets: 1 },
  coaching: {
    mode: 'repetition',
    target: { type: 'reps', value: 8, sets: 1 },
    repetitionSource: 'native',
    scoringSupported: true,
    playable: true,
  },
  equipment: [],
  durationMinutes: 6,
  xp: 40,
  access: { state: 'available', launchAllowed: true, reasons: [] },
};

describe('HomeScreen', () => {
  it('shows an honest loading state without inert notification or readiness controls', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <HomeScreen loading onStartLesson={jest.fn()} />,
      );
    });

    expect(renderedText(renderer)).toContain('Memuat ringkasan server…');
    expect(renderedText(renderer)).not.toContain('CEK KESIAPAN');
    expect(
      renderer.root.findAll(
        node => node.props.accessibilityLabel === 'Buka notifikasi',
      ),
    ).toHaveLength(0);
  });

  it('shows an API error and invokes retry without inventing progress', async () => {
    const onRetry = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <HomeScreen error="API tidak dapat dijangkau." onRetry={onRetry} />,
      );
    });

    expect(renderedText(renderer)).toContain('Ringkasan belum bisa dimuat.');
    expect(renderedText(renderer)).toContain('API tidak dapat dijangkau.');
    expect(renderedText(renderer)).not.toContain('— hari');

    await ReactTestRenderer.act(() => {
      renderer.root
        .find(
          node => node.props.accessibilityLabel === 'Coba muat ulang ringkasan',
        )
        .props.onPress();
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders only supplied server values and launches the recommended lesson', async () => {
    const onStartLesson = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <HomeScreen
          onStartLesson={onStartLesson}
          summary={{
            displayName: 'Raka',
            weekLabel: '1/6 lesson selesai',
            nextLesson: lesson,
            progress: {
              xp: { today: 30, dailyCap: 60 },
              streak: { current: 2 },
            },
            courseProgress: { completed: 1, total: 6 },
          }}
        />,
      );
    });

    const text = renderedText(renderer);
    expect(text).toContain('Squat Dasar');
    expect(text).toContain('30 / 60');
    expect(text).toContain('1 dari 6 pelajaran');

    await ReactTestRenderer.act(() => {
      renderer.root
        .find(
          node =>
            node.props.accessibilityLabel === 'Lanjutkan latihan Squat Dasar',
        )
        .props.onPress();
    });

    expect(onStartLesson).toHaveBeenCalledTimes(1);
  });
});
