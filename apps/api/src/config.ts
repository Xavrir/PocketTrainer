import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
    DATA_STORE: z.enum(['memory', 'postgres']).default('memory'),
    DATABASE_URL: z.string().startsWith('postgresql://').optional(),
    DATABASE_SSL: booleanFromString,
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
    REQUEST_BODY_LIMIT: z.string().default('1mb'),
    CORS_ORIGINS: z.string().default(''),
    OUTBOX_POLL_MS: z.coerce.number().int().min(0).max(300_000).default(30_000),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_JWT_ISSUER: z.string().url().optional(),
    SUPABASE_JWT_AUDIENCE: z.string().min(1).default('authenticated'),
    CONTENT_BASE_URL: z.string().url().default('https://content.pockettrainer.app'),
    ALLOW_INSECURE_DEV_AUTH: booleanFromString,
    DEV_AUTH_SUBJECT: z.string().uuid().optional(),
  })
  .superRefine((environment, context) => {
    if (environment.NODE_ENV === 'production' && environment.ALLOW_INSECURE_DEV_AUTH) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ALLOW_INSECURE_DEV_AUTH'],
        message: 'Insecure development authentication cannot run in production.',
      });
    }
    if (environment.DATA_STORE === 'postgres' && !environment.DATABASE_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL is required when DATA_STORE=postgres.',
      });
    }
    if (environment.NODE_ENV === 'production' && environment.DATA_STORE !== 'postgres') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATA_STORE'],
        message: 'Production must use the PostgreSQL data store.',
      });
    }
    if (!environment.ALLOW_INSECURE_DEV_AUTH && !environment.SUPABASE_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_URL'],
        message: 'SUPABASE_URL is required unless development authentication is enabled.',
      });
    }
    if (environment.SUPABASE_URL) {
      const supabaseUrl = new URL(environment.SUPABASE_URL);
      if (supabaseUrl.protocol !== 'https:' && environment.NODE_ENV === 'production') {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['SUPABASE_URL'], message: 'Production Supabase Auth must use HTTPS.' });
      }
      const issuer = environment.SUPABASE_JWT_ISSUER ?? `${environment.SUPABASE_URL.replace(/\/$/, '')}/auth/v1`;
      const expectedIssuer = `${environment.SUPABASE_URL.replace(/\/$/, '')}/auth/v1`;
      if (issuer !== expectedIssuer) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['SUPABASE_JWT_ISSUER'], message: 'JWT issuer must be the configured Supabase Auth issuer.' });
      }
      if (environment.NODE_ENV === 'production' && !environment.SUPABASE_JWT_ISSUER) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['SUPABASE_JWT_ISSUER'], message: 'Production must pin SUPABASE_JWT_ISSUER explicitly.' });
      }
    }
  });

export type AppConfig = z.infer<typeof environmentSchema>;

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid API configuration: ${details}`);
  }
  return result.data;
}
