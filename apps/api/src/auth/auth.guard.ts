import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ApiError } from '../common/api-error';
import { APP_CONFIG, type AppConfig } from '../config';
import { PocketTrainerRepository } from '../repositories/pocket-trainer.repository';
import { IS_PUBLIC_ROUTE } from './public.decorator';
import { SupabaseTokenVerifier } from './supabase-token.verifier';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly verifier: SupabaseTokenVerifier,
    private readonly repository: PocketTrainerRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.header('authorization');
    let subject: string | undefined;
    let roles: string[] = [];

    if (authorization?.startsWith('Bearer ')) {
      try {
        const payload = await this.verifier.verify(authorization.slice(7));
        subject = payload.sub;
        roles = Array.isArray(payload.app_metadata && (payload.app_metadata as Record<string, unknown>).roles)
          ? ((payload.app_metadata as Record<string, unknown>).roles as string[])
          : [];
      } catch {
        throw new ApiError('AUTH_TOKEN_INVALID', 'The access token is invalid or expired.', HttpStatus.UNAUTHORIZED, true);
      }
    } else if (this.config.ALLOW_INSECURE_DEV_AUTH && this.config.NODE_ENV !== 'production') {
      subject = request.header('x-dev-auth-subject') ?? this.config.DEV_AUTH_SUBJECT;
    }

    if (!subject) throw new ApiError('AUTH_REQUIRED', 'Authentication is required.', HttpStatus.UNAUTHORIZED, true);
    const identity = await this.repository.resolveIdentity(subject);
    Object.assign(request, { user: { ...identity, roles: [...new Set([...identity.roles, ...roles])] } });
    return true;
  }
}
