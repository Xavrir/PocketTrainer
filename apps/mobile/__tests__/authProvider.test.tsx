/** @format */

import React from 'react';
import { AppState } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {
  AuthProvider,
  type AuthContextValue,
  useAuth,
} from '../src/auth/AuthProvider';

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignOut = jest.fn();
const mockSignUp = jest.fn();
const mockStartAutoRefresh = jest.fn();
const mockStopAutoRefresh = jest.fn();
const mockUnsubscribe = jest.fn();

let mockAuthStateListener: ((event: string, session: unknown) => void) | null;

jest.mock('../src/config/publicConfig', () => ({
  publicConfig: { allowAuthBypass: false },
}));

jest.mock('../src/auth/supabase', () => ({
  isSupabaseConfigured: true,
  getSupabaseClient: () => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      signUp: mockSignUp,
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
    mockGetSession.mockReset();
    mockSignInWithPassword.mockReset();
    mockSignOut.mockReset();
    mockSignUp.mockReset();
    mockStartAutoRefresh.mockReset();
    mockStopAutoRefresh.mockReset();
    mockUnsubscribe.mockReset();
    mockOnAuthStateChange.mockReset().mockImplementation(listener => {
      mockAuthStateListener = listener;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({
      remove: jest.fn(),
    });
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

  it('supports sign in, sign up confirmation, and logout', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockSignInWithPassword.mockResolvedValue({
      data: { session: { access_token: 'signed-in-token' } },
      error: null,
    });
    mockSignUp.mockResolvedValue({
      data: { session: null },
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
      await expect(
        latestAuth.signIn('ayu@example.com', 'password123'),
      ).resolves.toEqual({});
    });
    expect(latestAuth.session?.access_token).toBe('signed-in-token');
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'ayu@example.com',
      password: 'password123',
    });

    await expect(
      latestAuth.signUp('new@example.com', 'password123'),
    ).resolves.toEqual({ requiresEmailConfirmation: true });

    await ReactTestRenderer.act(async () => {
      await latestAuth.signOut();
    });
    expect(latestAuth.session).toBeNull();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(() => renderer.unmount());
  });
});
