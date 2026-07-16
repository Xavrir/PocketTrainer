import 'react-native-url-polyfill/auto';
import {
  createClient,
  processLock,
  SupabaseClient,
} from '@supabase/supabase-js';
import { publicConfig } from '../config/publicConfig';
import { isSupabasePublicKey, isSupabaseUrl } from './configuration';

let client: SupabaseClient | null = null;

export const isSupabaseConfigured =
  isSupabaseUrl(publicConfig.supabaseUrl) &&
  isSupabasePublicKey(publicConfig.supabasePublishableKey);

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(
      publicConfig.supabaseUrl,
      publicConfig.supabasePublishableKey,
      {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: false,
          lock: processLock,
          persistSession: true,
        },
      },
    );
  }
  return client;
}
