import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import type { AssessmentCompletionV2 } from '../api';
import { AssessmentResultScreen } from './AssessmentResultScreen';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

function screenText(renderer: ReactTestRenderer.ReactTestRenderer): string {
  const collect = (value: unknown): string[] => {
    if (typeof value === 'string' || typeof value === 'number') {
      return [String(value)];
    }
    if (Array.isArray(value)) return value.flatMap(collect);
    if (value && typeof value === 'object' && 'children' in value) {
      return collect((value as { children?: unknown }).children);
    }
    return [];
  };
  return collect(renderer.toJSON()).join(' ');
}

function completion(
  overrides: Partial<AssessmentCompletionV2> = {},
): AssessmentCompletionV2 {
  return {
    assessment: {
      id: 'assessment-1',
      status: 'completed',
      assessmentVersion: '2.0.0',
      startedAt: '2026-07-17T00:00:00.000Z',
      completedAt: '2026-07-17T00:00:12.000Z',
      result: {
        version: 2,
        lowerBodyControl: 84,
        upperBodyControl: null,
        balance: null,
        mobility: null,
        coreStability: null,
        recommendedLevel: 'foundation',
        evidence: {
          squatSessionId: 'session-1',
          targetReps: 3,
          validReps: 3,
          durationMs: 12_000,
          confidenceEligible: true,
          formScore: 84,
          painReported: false,
        },
        progressionSuppressed: false,
      },
    },
    xpAwarded: 75,
    currentPlan: null,
    progressionSuppressed: false,
    ...overrides,
  };
}

describe('AssessmentResultScreen', () => {
  it('shows only the measured squat capability', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <AssessmentResultScreen completion={completion()} onDone={jest.fn()} />,
      );
    });

    const text = screenText(renderer);
    expect(text).toContain('84 / 100');
    expect(text.match(/— BELUM DIUKUR/g)).toHaveLength(4);
  });

  it('shows no score when progression is suppressed', async () => {
    const suppressed = completion({
      xpAwarded: 0,
      progressionSuppressed: true,
      assessment: {
        ...completion().assessment,
        result: {
          ...completion().assessment.result!,
          version: 2,
          lowerBodyControl: null,
          progressionSuppressed: true,
        } as AssessmentCompletionV2['assessment']['result'],
      },
    });
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <AssessmentResultScreen completion={suppressed} onDone={jest.fn()} />,
      );
    });

    const text = screenText(renderer);
    expect(text).toContain('Tidak diberi skor');
    expect(text).toContain('+ 0');
    expect(text).not.toContain('84 / 100');
  });
});
