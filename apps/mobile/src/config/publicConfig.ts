import { resolveApiBaseUrl } from './apiBaseUrl';

export type PublicConfig = {
  allowAuthBypass: boolean;
  apiBaseUrl: string;
  apiBaseUrlError?: string;
  supabasePublishableKey: string;
  supabaseUrl: string;
};

declare const process: {
  env: Record<string, string | undefined>;
};

const clean = (value: string | undefined) => value?.trim() ?? '';
const apiBaseUrl = resolveApiBaseUrl(
  process.env.POCKETTRAINER_API_BASE_URL,
  process.env.NODE_ENV === 'production',
);

export const publicConfig: PublicConfig = {
  allowAuthBypass:
    process.env.NODE_ENV === 'test' ||
    (process.env.NODE_ENV !== 'production' &&
      clean(process.env.POCKETTRAINER_ALLOW_AUTH_BYPASS) === 'true'),
  apiBaseUrl: apiBaseUrl.value,
  apiBaseUrlError: apiBaseUrl.error,
  supabasePublishableKey: clean(
    process.env.POCKETTRAINER_SUPABASE_PUBLISHABLE_KEY,
  ),
  supabaseUrl: clean(process.env.POCKETTRAINER_SUPABASE_URL),
};
