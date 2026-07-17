import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { LiveCoachScreen, resolveActiveDurationMs } from './LiveCoachScreen';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe('LiveCoachScreen movement safety', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses the session timer instead of camera visibility for guided holds', () => {
    expect(
      resolveActiveDurationMs({
        postureScored: false,
        elapsedTimeMs: 20_000,
        trackedDurationMs: 8_000,
        nativeValidHoldDurationMs: 30_000,
      }),
    ).toBe(20_000);
  });

  it('does not advance a guided yoga timer while paused', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-17T00:00:00.000Z'));
    const onComplete = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <LiveCoachScreen
          exerciseKey="warrior_ii"
          onComplete={onComplete}
          onStop={jest.fn()}
          sessionId="guided-yoga"
          targetType="duration_ms"
          targetValue={2_000}
        />,
      );
    });

    const findButton = (label: string) =>
      renderer.root.find(node => node.props.accessibilityLabel === label);

    ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(1_000);
      findButton('Jeda').props.onPress();
      jest.advanceTimersByTime(5_000);
    });
    expect(findButton('Selesaikan set').props.disabled).toBe(true);

    ReactTestRenderer.act(() => {
      findButton('Lanjutkan').props.onPress();
      jest.advanceTimersByTime(1_250);
    });
    expect(findButton('Selesaikan set').props.disabled).toBe(false);

    ReactTestRenderer.act(() => {
      findButton('Selesaikan set').props.onPress();
    });

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        coachingMode: 'guided_practice',
        durationSource: 'session_timer',
        formScore: null,
        progressionEligible: false,
        targetMet: true,
      }),
    );
    expect(
      onComplete.mock.calls[0]?.[0].activeDurationMs,
    ).toBeGreaterThanOrEqual(2_000);
    expect(onComplete.mock.calls[0]?.[0].activeDurationMs).toBeLessThan(3_000);

    ReactTestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
