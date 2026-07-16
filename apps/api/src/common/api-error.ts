import { HttpException, HttpStatus } from '@nestjs/common';

export type ApiErrorBody = {
  code: string;
  message: string;
  recoverable: boolean;
  details?: unknown;
};

export class ApiError extends HttpException {
  constructor(
    code: string,
    message: string,
    status: HttpStatus,
    recoverable = false,
    details?: unknown,
  ) {
    const body: ApiErrorBody = { code, message, recoverable };
    if (details !== undefined) {
      body.details = details;
    }
    super(body, status);
  }
}
