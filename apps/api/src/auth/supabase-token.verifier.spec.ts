import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { loadConfig, type AppConfig } from '../config';
import { SupabaseTokenVerifier } from './supabase-token.verifier';

describe('Supabase JWT verification boundary', () => {
  let server: Server;
  let config: AppConfig;
  let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

  beforeAll(async () => {
    const generated = await generateKeyPair('RS256');
    privateKey = generated.privateKey;
    const publicJwk = await exportJWK(generated.publicKey) as JWK;
    server = createServer((request, response) => {
      if (request.url !== '/auth/v1/.well-known/jwks.json') {
        response.writeHead(404).end();
        return;
      }
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ keys: [{ ...publicJwk, kid: 'test-key', alg: 'RS256', use: 'sig' }] }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    const supabaseUrl = `http://127.0.0.1:${address.port}`;
    config = loadConfig({
      NODE_ENV: 'test',
      DATA_STORE: 'memory',
      ALLOW_INSECURE_DEV_AUTH: 'false',
      SUPABASE_URL: supabaseUrl,
      SUPABASE_JWT_ISSUER: `${supabaseUrl}/auth/v1`,
      SUPABASE_JWT_AUDIENCE: 'authenticated',
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  async function token(overrides: { issuer?: string; audience?: string; expiration?: string | number } = {}): Promise<string> {
    const issuer = overrides.issuer ?? `${config.SUPABASE_URL}/auth/v1`;
    return new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject('00000000-0000-4000-8000-000000000099')
      .setIssuer(issuer)
      .setAudience(overrides.audience ?? config.SUPABASE_JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(overrides.expiration ?? '1h')
      .sign(privateKey);
  }

  it('accepts a signed token with the pinned issuer, audience, subject and expiry', async () => {
    const payload = await new SupabaseTokenVerifier(config).verify(await token());
    expect(payload.sub).toBe('00000000-0000-4000-8000-000000000099');
  });

  it.each([
    ['wrong issuer', { issuer: 'http://wrong.example/auth/v1' }],
    ['wrong audience', { audience: 'other-audience' }],
    ['expired token', { expiration: Math.floor(Date.now() / 1000) - 10 }],
  ])('rejects %s', async (_label, overrides) => {
    await expect(new SupabaseTokenVerifier(config).verify(await token(overrides))).rejects.toThrow();
  });
});
