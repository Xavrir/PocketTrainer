import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { publicConfig } from '../config/publicConfig';

export type AuthResult = {
  error?: string;
  requiresEmailConfirmation?: boolean;
};

export type AuthContextValue = {
  bypassAllowed: boolean;
  configured: boolean;
  loading: boolean;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function messageFor(error: { message: string }): string {
  const message = error.message.toLowerCase();
  if (message.includes('invalid login credentials')) {
    return 'Email atau kata sandi tidak cocok.';
  }
  if (message.includes('email not confirmed')) {
    return 'Konfirmasi emailmu terlebih dahulu.';
  }
  if (message.includes('password')) {
    return 'Kata sandi harus memiliki minimal 8 karakter.';
  }
  if (message.includes('email')) return 'Masukkan alamat email yang valid.';
  return 'Autentikasi belum berhasil. Coba lagi.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setLoading(false);
      return;
    }
    let active = true;
    let observedAuthStateChanges = 0;
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      observedAuthStateChanges += 1;
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    const stateChangesBeforeRestore = observedAuthStateChanges;
    client.auth
      .getSession()
      .then(({ data: restored, error }) => {
        if (!active) return;
        if (!error && observedAuthStateChanges === stateChangesBeforeRestore) {
          setSession(restored.session);
        }
      })
      .catch(() => {
        if (active && observedAuthStateChanges === stateChangesBeforeRestore) {
          setSession(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
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

    return () => {
      active = false;
      data.subscription.unsubscribe();
      appStateSubscription?.remove();
      if (Platform.OS !== 'web') client.auth.stopAutoRefresh();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const client = getSupabaseClient();
      if (!client) return { error: 'Supabase Auth belum dikonfigurasi.' };
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) return { error: messageFor(error) };
        setSession(data.session);
        return {};
      } catch {
        return {
          error: 'Tidak dapat terhubung. Periksa koneksi lalu coba lagi.',
        };
      }
    },
    [],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const client = getSupabaseClient();
      if (!client) return { error: 'Supabase Auth belum dikonfigurasi.' };
      try {
        const { data, error } = await client.auth.signUp({ email, password });
        if (error) return { error: messageFor(error) };
        if (data.session) setSession(data.session);
        return { requiresEmailConfirmation: !data.session };
      } catch {
        return {
          error: 'Tidak dapat terhubung. Periksa koneksi lalu coba lagi.',
        };
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw new Error(messageFor(error));
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      bypassAllowed: publicConfig.allowAuthBypass,
      configured: isSupabaseConfigured,
      loading,
      session,
      signIn,
      signOut,
      signUp,
    }),
    [loading, session, signIn, signOut, signUp],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
