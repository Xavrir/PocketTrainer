import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, Linking, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { publicConfig } from '../config/publicConfig';
import { AUTH_REDIRECT_URL, parseAuthCallbackUrl } from './authCallback';

export type AuthResult = {
  error?: string;
  emailOtpSent?: boolean;
};

export type AuthContextValue = {
  bypassAllowed: boolean;
  configured: boolean;
  loading: boolean;
  session: Session | null;
  callbackError?: string;
  clearCallbackError: () => void;
  sendEmailOtp: (email: string) => Promise<AuthResult>;
  verifyEmailOtp: (email: string, token: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function messageFor(
  error: { message: string },
  context: 'callback' | 'otp' | 'general' = 'general',
): string {
  const message = error.message.toLowerCase();
  if (message.includes('provider is not enabled')) {
    return 'Login Google belum diaktifkan pada proyek Supabase.';
  }
  if (
    context === 'callback' &&
    (message.includes('token has expired') ||
      message.includes('token is expired') ||
      message.includes('invalid token') ||
      message.includes('code verifier'))
  ) {
    return 'Tautan login tidak valid atau sudah kedaluwarsa. Minta tautan baru.';
  }
  if (
    context === 'otp' &&
    (message.includes('token') || message.includes('code'))
  ) {
    return 'Kode OTP salah atau sudah kedaluwarsa. Minta kode baru.';
  }
  if (message.includes('access_denied')) return 'Login dibatalkan.';
  if (message.includes('rate limit')) {
    return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
  }
  if (message.includes('email')) return 'Masukkan alamat email yang valid.';
  return 'Autentikasi belum berhasil. Coba lagi.';
}

async function sessionFromCallback(url: string): Promise<Session | null> {
  const callback = parseAuthCallbackUrl(url);
  if (callback.kind === 'none') return null;
  if (callback.kind === 'error') throw new Error(callback.message);

  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase Auth belum dikonfigurasi.');

  if (callback.kind === 'pkce') {
    const { data, error } = await client.auth.exchangeCodeForSession(
      callback.code,
    );
    if (error) throw error;
    return data.session;
  }

  const { data, error } = await client.auth.setSession({
    access_token: callback.accessToken,
    refresh_token: callback.refreshToken,
  });
  if (error) throw error;
  return data.session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [callbackError, setCallbackError] = useState<string>();

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setLoading(false);
      return;
    }
    let active = true;
    let observedAuthStateChanges = 0;
    const completedAuthUrls = new Set<string>();
    const authUrlTasks = new Map<
      string,
      Promise<'completed' | 'failed' | 'ignored'>
    >();
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      observedAuthStateChanges += 1;
      if (!active) return;
      setSession(nextSession);
    });

    const updateAutoRefresh = (state: string) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    const appStateSubscription =
      Platform.OS === 'web'
        ? null
        : AppState.addEventListener('change', state => {
            updateAutoRefresh(state);
          });
    if (Platform.OS !== 'web') updateAutoRefresh(AppState.currentState);

    const handleUrl = (
      url: string,
    ): Promise<'completed' | 'failed' | 'ignored'> => {
      if (completedAuthUrls.has(url)) return Promise.resolve('completed');
      const existingTask = authUrlTasks.get(url);
      if (existingTask) return existingTask;

      const task = sessionFromCallback(url)
        .then(nextSession => {
          if (!nextSession) return 'ignored' as const;
          completedAuthUrls.add(url);
          if (!active) return 'completed' as const;
          setCallbackError(undefined);
          setSession(nextSession);
          return 'completed' as const;
        })
        .catch(error => {
          if (!active) return;
          const authError =
            error instanceof Error
              ? messageFor(error, 'callback')
              : 'Callback autentikasi tidak dapat diproses.';
          setCallbackError(authError);
          return 'failed' as const;
        })
        .then(result => result ?? ('failed' as const))
        .finally(() => {
          authUrlTasks.delete(url);
        });
      authUrlTasks.set(url, task);
      return task;
    };
    const linkingSubscription = Linking.addEventListener('url', event => {
      handleUrl(event.url).catch(() => undefined);
    });

    const initialize = async () => {
      let initialCallback: 'completed' | 'failed' | 'ignored' = 'ignored';
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) initialCallback = await handleUrl(initialUrl);
      } catch {
        if (active) {
          setCallbackError('Tautan login awal tidak dapat dibuka.');
        }
        initialCallback = 'failed';
      }

      if (initialCallback !== 'completed') {
        const stateChangesBeforeRestore = observedAuthStateChanges;
        try {
          const { data: restored, error } = await client.auth.getSession();
          if (error) throw error;
          if (
            active &&
            observedAuthStateChanges === stateChangesBeforeRestore
          ) {
            setSession(restored.session);
          }
        } catch {
          if (
            active &&
            observedAuthStateChanges === stateChangesBeforeRestore
          ) {
            setSession(null);
          }
        }
      }

      if (active) setLoading(false);
    };
    initialize().catch(() => {
      if (!active) return;
      setCallbackError('Autentikasi awal tidak dapat diproses.');
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
      appStateSubscription?.remove();
      linkingSubscription.remove();
      if (Platform.OS !== 'web') client.auth.stopAutoRefresh();
    };
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    const client = getSupabaseClient();
    if (!client) return { error: 'Supabase Auth belum dikonfigurasi.' };
    setCallbackError(undefined);
    try {
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: AUTH_REDIRECT_URL,
          skipBrowserRedirect: true,
        },
      });
      if (error) return { error: messageFor(error) };
      if (!data.url) return { error: 'URL login Google tidak tersedia.' };
      await Linking.openURL(data.url);
      return {};
    } catch {
      return {
        error:
          'Tidak dapat membuka login Google. Periksa koneksi lalu coba lagi.',
      };
    }
  }, []);

  const sendEmailOtp = useCallback(
    async (email: string): Promise<AuthResult> => {
      const client = getSupabaseClient();
      if (!client) return { error: 'Supabase Auth belum dikonfigurasi.' };
      setCallbackError(undefined);
      try {
        const { error } = await client.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
          },
        });
        if (error) return { error: messageFor(error) };
        return { emailOtpSent: true };
      } catch {
        return {
          error: 'Tidak dapat terhubung. Periksa koneksi lalu coba lagi.',
        };
      }
    },
    [],
  );

  const verifyEmailOtp = useCallback(
    async (email: string, token: string): Promise<AuthResult> => {
      const client = getSupabaseClient();
      if (!client) return { error: 'Supabase Auth belum dikonfigurasi.' };
      setCallbackError(undefined);
      try {
        const { data, error } = await client.auth.verifyOtp({
          email,
          token,
          type: 'email',
        });
        if (error) return { error: messageFor(error, 'otp') };
        if (data.session) setSession(data.session);
        return {};
      } catch {
        return {
          error:
            'Tidak dapat memverifikasi kode. Periksa koneksi lalu coba lagi.',
        };
      }
    },
    [],
  );

  const clearCallbackError = useCallback(() => setCallbackError(undefined), []);

  const signOut = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.auth.signOut({ scope: 'local' });
    setSession(null);
    if (error) throw new Error(messageFor(error));
  }, []);

  const value = useMemo(
    () => ({
      bypassAllowed: publicConfig.allowAuthBypass,
      callbackError,
      clearCallbackError,
      configured: isSupabaseConfigured,
      loading,
      sendEmailOtp,
      session,
      signInWithGoogle,
      signOut,
      verifyEmailOtp,
    }),
    [
      callbackError,
      clearCallbackError,
      loading,
      sendEmailOtp,
      session,
      signInWithGoogle,
      signOut,
      verifyEmailOtp,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
