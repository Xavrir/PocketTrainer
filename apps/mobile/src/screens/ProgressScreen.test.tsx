import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ProgressScreen, type MobileProgress } from './ProgressScreen';

function renderedText(renderer: ReactTestRenderer.ReactTestRenderer): string {
  return renderer.root
    .findAllByType(Text)
    .flatMap(node => React.Children.toArray(node.props.children))
    .filter((value): value is string | number =>
      ['string', 'number'].includes(typeof value),
    )
    .join(' ');
}

const progress: MobileProgress = {
  xp: {
    total: 1250,
    today: 40,
    dailyCap: 80,
    level: 3,
    currentLevelXp: 120,
    nextLevelXp: 200,
  },
  streak: { current: 2, longest: 5, todayStatus: 'active' },
  completedLessonIds: ['lesson-1'],
  mastery: [
    {
      exerciseKey: 'body_squat',
      bestFormScore: 84,
      qualifyingSessions: 2,
      mastered: false,
      restricted: false,
    },
    {
      exerciseKey: 'incline_push_up',
      bestFormScore: 99,
      qualifyingSessions: 3,
      mastered: true,
      restricted: false,
    },
  ],
  achievements: [
    { key: 'first_workout', unlockedAt: '2026-07-17T10:00:00.000Z' },
  ],
};

describe('ProgressScreen', () => {
  it('distinguishes loading from an empty server result', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<ProgressScreen loading />);
    });
    expect(renderedText(renderer)).toContain('Memuat progres server…');

    await ReactTestRenderer.act(() => {
      renderer.update(<ProgressScreen />);
    });
    expect(renderedText(renderer)).toContain('Progres belum tersedia.');
    expect(renderedText(renderer)).not.toContain('88');
  });

  it('shows a recoverable API error and invokes retry', async () => {
    const onRetry = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ProgressScreen
          error="Server tidak dapat dijangkau."
          onRetry={onRetry}
        />,
      );
    });

    expect(renderedText(renderer)).toContain('Progres belum bisa dimuat.');
    expect(renderedText(renderer)).toContain('Server tidak dapat dijangkau.');

    await ReactTestRenderer.act(() => {
      renderer.root
        .find(
          node => node.props.accessibilityLabel === 'Coba muat ulang progres',
        )
        .props.onPress();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders server-confirmed values without an inert achievement chevron', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ProgressScreen progress={progress} />,
      );
    });

    const text = renderedText(renderer);
    expect(text).toContain('1.250');
    expect(text).toContain('40');
    expect(text).toContain('XP hari ini');
    expect(text).toContain('84');
    expect(text).not.toContain('99');
    expect(text).not.toContain('Push-up miring');
    expect(text).toContain('first_workout');
    expect(
      renderer.root.findAll(node => node.props.name === 'chevron'),
    ).toHaveLength(0);
  });

  it('keeps existing values visible while refresh fails and offers retry', async () => {
    const onRetry = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ProgressScreen
          error="Jaringan terputus."
          onRetry={onRetry}
          progress={progress}
        />,
      );
    });

    expect(renderedText(renderer)).toContain('Penyegaran gagal.');
    expect(renderedText(renderer)).toContain('1.250');

    await ReactTestRenderer.act(() => {
      renderer.root
        .find(
          node => node.props.accessibilityLabel === 'Coba muat ulang progres',
        )
        .props.onPress();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
