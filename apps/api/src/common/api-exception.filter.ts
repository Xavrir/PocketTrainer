import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorBody } from './api-error';

type RequestWithId = Request & { requestId?: string };

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<RequestWithId>();
    const requestId = request.requestId ?? 'unknown';
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;

    let body: ApiErrorBody;
    if (typeof raw === 'object' && raw !== null && 'code' in raw && 'message' in raw) {
      body = raw as ApiErrorBody;
    } else if (status === HttpStatus.BAD_REQUEST) {
      body = {
        code: 'INVALID_REQUEST',
        message: 'The request could not be validated.',
        recoverable: true,
        ...(raw === undefined ? {} : { details: raw }),
      };
    } else {
      body = {
        code: 'INTERNAL_ERROR',
        message: 'The server could not complete the request.',
        recoverable: true,
      };
    }

    if (status >= 500) {
      this.logger.error({ requestId, path: request.path, exception });
    }

    response.status(status).json({ error: { ...body, requestId } });
  }
}
