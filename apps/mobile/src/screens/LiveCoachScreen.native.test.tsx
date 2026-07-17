import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../native/requestCameraPermission', () => ({
  requestCameraPermission: () => Promise.resolve(true),
}));

jest.mock('../native/PoseCameraView', () => {
  const { createElement } = require('react');
  const { View } = require('react-native');
  return {
    isNativePoseCameraAvailable: true,
    PoseCameraView: (props: Record<string, unknown>) =>
      createElement(View, { ...props, testID: 'pose-camera' }),
  };
});

import { LiveCoachScreen } from './LiveCoachScreen';

describe('LiveCoachScreen native pause boundary', () => {
  it('stops native processing and ignores queued progress until tracking reacquires', async () => {
    const onComplete = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <LiveCoachScreen
          exerciseKey="body_squat"
          onComplete={onComplete}
          onStop={jest.fn()}
          painState="none"
          sessionId="native-pause"
          targetType="repetitions"
          targetValue={2}
        />,
      );
      await Promise.resolve();
    });

    const findButton = (label: string) =>
      renderer.root.find(node => node.props.accessibilityLabel === label);
    const camera = () => renderer.root.findByProps({ testID: 'pose-camera' });

    ReactTestRenderer.act(() => {
      camera().props.onPoseEvent({
        type: 'tracking_status',
        confidence: 0.95,
        visible: true,
      });
      camera().props.onPoseEvent({
        type: 'rep_complete',
        rep: 1,
        confidence: 0.95,
        formScore: 90,
      });
      findButton('Jeda').props.onPress();
    });
    expect(camera().props.paused).toBe(true);

    ReactTestRenderer.act(() => {
      camera().props.onPoseEvent({
        type: 'rep_complete',
        rep: 2,
        confidence: 0.95,
        formScore: 100,
      });
      findButton('Lanjutkan').props.onPress();
    });
    expect(camera().props.paused).toBe(false);
    expect(findButton('Selesaikan set').props.disabled).toBe(true);

    ReactTestRenderer.act(() => {
      camera().props.onPoseEvent({
        type: 'tracking_status',
        confidence: 0.95,
        visible: true,
      });
    });
    expect(findButton('Selesaikan set').props.disabled).toBe(true);

    ReactTestRenderer.act(() => {
      camera().props.onPoseEvent({
        type: 'rep_complete',
        rep: 2,
        confidence: 0.95,
        formScore: 92,
      });
    });
    expect(findButton('Selesaikan set').props.disabled).toBe(false);

    ReactTestRenderer.act(() => renderer.unmount());
  });
});
