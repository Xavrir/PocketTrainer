import { describe, expect, it } from 'vitest';
import { calculateStreakCounts } from './progress-policy';

describe('progress streak policy', () => {
  it('keeps current anchored to today and finds the longest historical run', () => {
    expect(calculateStreakCounts([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-10',
      '2026-07-16',
    ], '2026-07-16')).toEqual({ current: 1, longest: 3 });
  });

  it('deduplicates workout days and returns zero current when today is open', () => {
    expect(calculateStreakCounts(['2026-07-10', '2026-07-10', '2026-07-11'], '2026-07-16')).toEqual({ current: 0, longest: 2 });
  });
});
