import type { Response } from 'express';
import type { IdempotencyResult } from '../domain/domain.types';

export function sendIdempotent<T>(response: Response, result: IdempotencyResult<T>): T {
  response.setHeader('Idempotency-Replayed', String(result.replayed));
  return result.value;
}
