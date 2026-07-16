import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, AuthenticatedUser } from './request-context';

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedUser => {
  return context.switchToHttp().getRequest<AuthenticatedRequest>().user;
});
