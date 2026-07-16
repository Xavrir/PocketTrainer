export type PublicConfig = {
  allowAuthBypass: boolean;
  apiBaseUrl: string;
  supabasePublishableKey: string;
  supabaseUrl: string;
};

declare const process: {
  env: Record<string, string | undefined>;
};

const clean = (value: string | undefined) => value?.trim() ?? '';

export const publicConfig: PublicConfig = {
  allowAuthBypass:
    process.env.NODE_ENV === 'test' ||
    (process.env.NODE_ENV !== 'production' &&
      clean(process.env.POCKETTRAINER_ALLOW_AUTH_BYPASS) === 'true'),
  apiBaseUrl: clean(process.env.POCKETTRAINER_API_BASE_URL),
  supabasePublishableKey: clean(
    process.env.POCKETTRAINER_SUPABASE_PUBLISHABLE_KEY,
  ),
  supabaseUrl: clean(process.env.POCKETTRAINER_SUPABASE_URL),
};
