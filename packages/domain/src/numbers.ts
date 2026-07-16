export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function roundScore(value: number): number {
  return Math.round(clamp(value, 0, 100) * 100) / 100;
}

export function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number`);
  }
}

export function assertPercent(value: number, name: string): void {
  assertFiniteNumber(value, name);
  if (value < 0 || value > 100) {
    throw new RangeError(`${name} must be between 0 and 100`);
  }
}
