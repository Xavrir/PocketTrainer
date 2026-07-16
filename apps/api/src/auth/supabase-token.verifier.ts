import { Inject, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { APP_CONFIG, type AppConfig } from '../config';

@Injectable()
export class SupabaseTokenVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet> | null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.jwks = config.SUPABASE_URL
      ? createRemoteJWKSet(new URL(`${config.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`), {
          cooldownDuration: 30_000,
          cacheMaxAge: 10 * 60_000,
          timeoutDuration: 5_000,
        })
      : null;
  }

  async verify(token: string): Promise<JWTPayload> {
    if (!this.jwks || !this.config.SUPABASE_URL) throw new Error('Supabase authentication is not configured.');
    const issuer = this.config.SUPABASE_JWT_ISSUER ?? `${this.config.SUPABASE_URL.replace(/\/$/, '')}/auth/v1`;
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer,
      audience: this.config.SUPABASE_JWT_AUDIENCE,
      algorithms: ['ES256', 'RS256'],
      clockTolerance: 5,
    });
    return payload;
  }
}
