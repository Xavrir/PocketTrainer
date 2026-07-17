import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

const productionEnvironment = {
  NODE_ENV: 'production',
  DATA_STORE: 'postgres',
  DATABASE_URL: 'postgresql://pockettrainer_app:password@database.example.com:5432/pockettrainer',
  DATABASE_SSL: 'true',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_JWT_ISSUER: 'https://project.supabase.co/auth/v1',
  CONTENT_BASE_URL: 'https://content.pockettrainer.example',
} as const;

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

  it('accepts a persistent HTTPS production configuration', () => {
    expect(loadConfig(productionEnvironment)).toMatchObject({ DATA_STORE: 'postgres', DATABASE_SSL: true, NODE_ENV: 'production' });
  });

  it('rejects loopback PostgreSQL and disabled database TLS in production', () => {
    expect(() => loadConfig({
      ...productionEnvironment,
      DATABASE_URL: 'postgresql://pockettrainer_app:password@localhost:5432/pockettrainer',
      DATABASE_SSL: 'false',
    })).toThrow(/DATABASE_URL.*loopback.*DATABASE_SSL.*TLS/i);
  });

  it.each([
    'http://content.pockettrainer.example',
    'https://127.0.0.1:8787',
    'https://temporary-name.trycloudflare.com',
  ])('rejects unstable production content origin %s', (CONTENT_BASE_URL) => {
    expect(() => loadConfig({ ...productionEnvironment, CONTENT_BASE_URL })).toThrow(/stable public HTTPS origin/i);
  });
});
