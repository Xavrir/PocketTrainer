import Config from 'react-native-config';

export type PublicConfig = {
  allowAuthBypass: boolean;
  apiBaseUrl: string;
  supabasePublishableKey: string;
  supabaseUrl: string;
};

const clean = (value: string | undefined) => value?.trim() ?? '';

export const publicConfig: PublicConfig = {
  allowAuthBypass:
    __DEV__ && clean(Config.POCKETTRAINER_ALLOW_AUTH_BYPASS) === 'true',
  apiBaseUrl: clean(Config.POCKETTRAINER_API_BASE_URL),
  supabasePublishableKey: clean(Config.POCKETTRAINER_SUPABASE_PUBLISHABLE_KEY),
  supabaseUrl: clean(Config.POCKETTRAINER_SUPABASE_URL),
};
