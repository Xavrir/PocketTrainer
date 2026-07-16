import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const incoming = request.header('x-request-id');
    const requestId = incoming && incoming.length <= 128 ? incoming : randomUUID();
    Object.assign(request, { requestId });
    response.setHeader('x-request-id', requestId);
    next();
  }
}
