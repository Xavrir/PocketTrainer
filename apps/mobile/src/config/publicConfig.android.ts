import Config from 'react-native-config';
import { resolveApiBaseUrl } from './apiBaseUrl';

export type PublicConfig = {
  allowAuthBypass: boolean;
  apiBaseUrl: string;
  apiBaseUrlError?: string;
  supabasePublishableKey: string;
  supabaseUrl: string;
};

const clean = (value: string | undefined) => value?.trim() ?? '';
const apiBaseUrl = resolveApiBaseUrl(
  Config.POCKETTRAINER_API_BASE_URL,
  !__DEV__,
);

export const publicConfig: PublicConfig = {
  allowAuthBypass:
    __DEV__ && clean(Config.POCKETTRAINER_ALLOW_AUTH_BYPASS) === 'true',
  apiBaseUrl: apiBaseUrl.value,
  apiBaseUrlError: apiBaseUrl.error,
  supabasePublishableKey: clean(Config.POCKETTRAINER_SUPABASE_PUBLISHABLE_KEY),
  supabaseUrl: clean(Config.POCKETTRAINER_SUPABASE_URL),
};
