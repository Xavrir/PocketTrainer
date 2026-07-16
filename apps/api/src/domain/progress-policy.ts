const MILLISECONDS_PER_DAY = 86_400_000;

export type StreakCounts = {
  current: number;
  longest: number;
};

export function calculateStreakCounts(days: Iterable<string>, today: string): StreakCounts {
  const uniqueDays = new Set(days);
  const ordinals = [...uniqueDays].map(dayOrdinal).sort((left, right) => left - right);
  let longest = 0;
  let run = 0;
  let previous: number | undefined;

  for (const ordinal of ordinals) {
    run = previous !== undefined && ordinal === previous + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = ordinal;
  }

  let current = 0;
  let cursor = dayOrdinal(today);
  while (uniqueDays.has(dayFromOrdinal(cursor))) {
    current += 1;
    cursor -= 1;
  }

  return { current, longest };
}

function dayOrdinal(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / MILLISECONDS_PER_DAY);
}

function dayFromOrdinal(ordinal: number): string {
  return new Date(ordinal * MILLISECONDS_PER_DAY).toISOString().slice(0, 10);
}
