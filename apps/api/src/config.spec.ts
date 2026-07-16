import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('API configuration safety', () => {
  it('allows an isolated in-memory development server', () => {
    const config = loadConfig({ NODE_ENV: 'test', DATA_STORE: 'memory', ALLOW_INSECURE_DEV_AUTH: 'true' });
    expect(config.DATA_STORE).toBe('memory');
  });

  it('rejects development authentication and memory storage in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', DATA_STORE: 'memory', ALLOW_INSECURE_DEV_AUTH: 'true' })).toThrow(/production/i);
  });

  it('requires a database URL for PostgreSQL mode', () => {
    expect(() => loadConfig({ NODE_ENV: 'test', DATA_STORE: 'postgres', ALLOW_INSECURE_DEV_AUTH: 'true' })).toThrow(/DATABASE_URL/);
  });

  it('pins a configured Supabase issuer to the configured project URL', () => {
    expect(() => loadConfig({
      NODE_ENV: 'test',
      DATA_STORE: 'memory',
      ALLOW_INSECURE_DEV_AUTH: 'false',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_JWT_ISSUER: 'https://other.supabase.co/auth/v1',
    })).toThrow(/issuer/i);
  });
});
