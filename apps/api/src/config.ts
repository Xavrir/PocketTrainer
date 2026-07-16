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
