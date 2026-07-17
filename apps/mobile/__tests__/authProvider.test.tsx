/** @format */

import React from 'react';
import { AppState, Linking } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {
  AuthProvider,
  type AuthContextValue,
  useAuth,
} from '../src/auth/AuthProvider';

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockExchangeCodeForSession = jest.fn();
const mockSetSession = jest.fn();
const mockSignInWithOAuth = jest.fn();
const mockSignInWithOtp = jest.fn();
const mockVerifyOtp = jest.fn();
const mockSignOut = jest.fn();
const mockStartAutoRefresh = jest.fn();
const mockStopAutoRefresh = jest.fn();
const mockUnsubscribe = jest.fn();

let mockAuthStateListener: ((event: string, session: unknown) => void) | null;
let mockAppStateListener: ((state: string) => void) | null;
let mockUrlListener: ((event: { url: string }) => void) | null;

jest.mock('../src/config/publicConfig', () => ({
  publicConfig: { allowAuthBypass: false },
}));

jest.mock('../src/auth/supabase', () => ({
  isSupabaseConfigured: true,
  getSupabaseClient: () => ({
    auth: {
      getSession: mockGetSession,
      exchangeCodeForSession: mockExchangeCodeForSession,
      onAuthStateChange: mockOnAuthStateChange,
      setSession: mockSetSession,
      signInWithOAuth: mockSignInWithOAuth,
      signInWithOtp: mockSignInWithOtp,
      verifyOtp: mockVerifyOtp,
      signOut: mockSignOut,
      startAutoRefresh: mockStartAutoRefresh,
      stopAutoRefresh: mockStopAutoRefresh,
    },
  }),
}));

let latestAuth!: AuthContextValue;

function AuthProbe() {
  latestAuth = useAuth();
  return null;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolver => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe('AuthProvider', () => {
  beforeEach(() => {
    mockAuthStateListener = null;
    mockAppStateListener = null;
    mockUrlListener = null;
    mockGetSession.mockReset();
    mockExchangeCodeForSession.mockReset();
    mockSetSession.mockReset();
    mockSignInWithOAuth.mockReset();
    mockSignInWithOtp.mockReset();
    mockVerifyOtp.mockReset();
    mockSignOut.mockReset();
    mockStartAutoRefresh.mockReset();
    mockStopAutoRefresh.mockReset();
    mockUnsubscribe.mockReset();
    mockOnAuthStateChange.mockReset().mockImplementation(listener => {
      mockAuthStateListener = listener;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, listener) => {
        mockAppStateListener = listener as (state: string) => void;
        return { remove: jest.fn() };
      });
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest
      .spyOn(Linking, 'addEventListener')
      .mockImplementation((_type, listener) => {
        mockUrlListener = listener as (event: { url: string }) => void;
        return {
          remove: jest.fn(),
        } as unknown as ReturnType<typeof Linking.addEventListener>;
      });
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the boundary loading until the persisted session is restored', async () => {
    const restoration = deferred<{
      data: { session: { access_token: string } };
      error: null;
    }>();
    mockGetSession.mockReturnValue(restoration.promise);
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>,
      );
    });
    expect(latestAuth.loading).toBe(true);
    expect(latestAuth.session).toBeNull();

    await ReactTestRenderer.act(async () => {
      restoration.resolve({
        data: { session: { access_token: 'restored-token' } },
        error: null,
      });
      await restoration.promise;
    });

    expect(latestAuth.loading).toBe(false);
    expect(latestAuth.session?.access_token).toBe('restored-token');
    await ReactTestRenderer.act(() => renderer.unmount());
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite a newer auth event with a stale restoration result', async () => {
    const restoration = deferred<{
      data: { session: null };
      error: null;
    }>();
    mockGetSession.mockReturnValue(restoration.promise);
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>,
      );
    });

    await ReactTestRenderer.act(async () => {
      mockAuthStateListener?.('SIGNED_IN', { access_token: 'new-token' });
      restoration.resolve({ data: { session: null }, error: null });
      await restoration.promise;
    });

    expect(latestAuth.loading).toBe(false);
    expect(latestAuth.session?.access_token).toBe('new-token');
    await ReactTestRenderer.act(() => renderer.unmount());
  });

  it('exchanges a clean-device initial callback before finishing restoration', async () => {
    jest
      .mocked(Linking.getInitialURL)
      .mockResolvedValue('pockettrainer://auth/callback?code=cold-start-code');
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: 'callback-token' } },
      error: null,
    });
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>,
      );
    });

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('cold-start-code');
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(latestAuth.loading).toBe(false);
    expect(latestAuth.session?.access_token).toBe('callback-token');
    await ReactTestRenderer.act(() => renderer.unmount());
  });

  it('handles a warm email-link callback only once', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: 'email-link-token' } },
      error: null,
    });
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>,
      );
    });

    await ReactTestRenderer.act(async () => {
      mockUrlListener?.({
        url: 'pockettrainer://auth/callback?code=email-link-code',
      });
      mockUrlListener?.({
        url: 'pockettrainer://auth/callback?code=email-link-code',
      });
    });

    expect(mockExchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(latestAuth.session?.access_token).toBe('email-link-token');
    await ReactTestRenderer.act(() => renderer.unmount());
  });

  it('supports Google OAuth, email OTP, and local logout', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://example.supabase.co/oauth/google' },
      error: null,
    });
    mockSignInWithOtp.mockResolvedValue({ error: null });
    mockVerifyOtp.mockResolvedValue({
      data: { session: { access_token: 'otp-token' } },
      error: null,
    });
    mockSignOut.mockResolvedValue({ error: null });
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>,
      );
    });

    await ReactTestRenderer.act(async () => {
      await expect(latestAuth.signInWithGoogle()).resolves.toEqual({});
    });
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'pockettrainer://auth/callback',
        skipBrowserRedirect: true,
      },
    });
    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://example.supabase.co/oauth/google',
    );

    await expect(latestAuth.sendEmailOtp('ayu@example.com')).resolves.toEqual({
      emailOtpSent: true,
    });
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'ayu@example.com',
      options: {
        shouldCreateUser: true,
      },
    });

    await ReactTestRenderer.act(async () => {
      await expect(
        latestAuth.verifyEmailOtp('ayu@example.com', '123456'),
      ).resolves.toEqual({});
    });
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'ayu@example.com',
      token: '123456',
      type: 'email',
    });
    expect(latestAuth.session?.access_token).toBe('otp-token');

    await ReactTestRenderer.act(async () => {
      await latestAuth.signOut();
    });
    expect(latestAuth.session).toBeNull();
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    await ReactTestRenderer.act(() => renderer.unmount());
  });

  it('tracks refreshed sessions and foreground auto-refresh', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'initial-token' } },
      error: null,
    });
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>,
      );
    });

    mockStartAutoRefresh.mockClear();
    mockStopAutoRefresh.mockClear();
    await ReactTestRenderer.act(async () => {
      mockAppStateListener?.('background');
      mockAppStateListener?.('active');
      mockAuthStateListener?.('TOKEN_REFRESHED', {
        access_token: 'refreshed-token',
      });
    });

    expect(mockStopAutoRefresh).toHaveBeenCalledTimes(1);
    expect(mockStartAutoRefresh).toHaveBeenCalledTimes(1);
    expect(latestAuth.session?.access_token).toBe('refreshed-token');
    await ReactTestRenderer.act(() => renderer.unmount());
  });

  it('clears the local session when Supabase reports a logout API error', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'signed-in-token' } },
      error: null,
    });
    mockSignOut.mockResolvedValue({
      error: { message: 'network request failed' },
    });
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>,
      );
    });

    await ReactTestRenderer.act(async () => {
      await expect(latestAuth.signOut()).rejects.toThrow(
        'Autentikasi belum berhasil',
      );
    });

    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(latestAuth.session).toBeNull();
    await ReactTestRenderer.act(() => renderer.unmount());
  });
});
