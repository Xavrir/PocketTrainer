/** @format */

const mockCreateClient = jest.fn(() => ({ auth: {} }));
const mockSecureSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

jest.mock('../src/config/publicConfig', () => ({
  publicConfig: {
    supabasePublishableKey: 'sb_publishable_public-client-key',
    supabaseUrl: 'https://example.supabase.co',
  },
}));

jest.mock('../src/auth/secureSessionStorage', () => ({
  secureSessionStorage: mockSecureSessionStorage,
}));

describe('Android Supabase client storage', () => {
  beforeEach(() => {
    jest.resetModules();
    mockCreateClient.mockClear();
  });

  it('persists PKCE sessions with the secure storage adapter', () => {
    const { getSupabaseClient } = require('../src/auth/supabase.android') as {
      getSupabaseClient(): unknown;
    };

    expect(getSupabaseClient()).toBeTruthy();
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'sb_publishable_public-client-key',
      {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: 'pkce',
          persistSession: true,
          storage: mockSecureSessionStorage,
        },
      },
    );
  });
});
