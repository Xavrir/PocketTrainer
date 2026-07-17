import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { PrimaryButton } from '../components/PrimaryButton';
import { AssessmentIntroScreen, CameraSetupScreen } from './AssessmentScreens';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe('assessment screens', () => {
  it('describes a real three-rep squat assessment without broad fake scores', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <AssessmentIntroScreen onBack={jest.fn()} onContinue={jest.fn()} />,
      );
    });
    const text = renderer.root
      .findAllByType('Text' as never)
      .map(node => node.props.children)
      .flat(Infinity)
      .join(' ');

    expect(text).toContain('Tiga squat nyaman');
    expect(text).toContain('Kemampuan lain tetap ditandai belum diukur.');
    expect(text).toContain('3 REP');
  });

  it('exposes a truthful create failure with a retry callback', async () => {
    const onRetry = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <AssessmentIntroScreen
          error="API tidak dapat dijangkau."
          onBack={jest.fn()}
          onContinue={jest.fn()}
          onRetry={onRetry}
        />,
      );
    });
    const retry = renderer.root
      .findAllByType(PrimaryButton)
      .find(node => node.props.label === 'Coba buat lagi');

    ReactTestRenderer.act(() => retry?.props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('labels camera setup with the fixed assessment target', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <CameraSetupScreen
          mode="assessment"
          onBack={jest.fn()}
          onReady={jest.fn()}
        />,
      );
    });

    expect(
      renderer.root
        .findAllByType(PrimaryButton)
        .some(node => node.props.label === 'Mulai asesmen 3 repetisi'),
    ).toBe(true);
  });
});
