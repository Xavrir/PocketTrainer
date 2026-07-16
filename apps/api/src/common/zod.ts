import { HttpStatus } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ApiError } from './api-error';

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError(
      'INVALID_REQUEST',
      'The request body is invalid.',
      HttpStatus.BAD_REQUEST,
      true,
      result.error.flatten(),
    );
  }
  return result.data;
}

export function requireIdempotencyKey(value: string | undefined): string {
  const key = value?.trim();
  if (!key || key.length < 8 || key.length > 200 || !/^[A-Za-z0-9:_-]+$/.test(key)) {
    throw new ApiError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'A valid Idempotency-Key header is required.',
      HttpStatus.BAD_REQUEST,
      true,
    );
  }
  return key;
}
