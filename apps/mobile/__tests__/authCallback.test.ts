import {
  AUTH_REDIRECT_URL,
  parseAuthCallbackUrl,
} from '../src/auth/authCallback';

describe('parseAuthCallbackUrl', () => {
  it('reads an implicit Supabase session from the callback fragment', () => {
    expect(
      parseAuthCallbackUrl(
        `${AUTH_REDIRECT_URL}#access_token=access&refresh_token=refresh`,
      ),
    ).toEqual({
      kind: 'session',
      accessToken: 'access',
      refreshToken: 'refresh',
    });
  });

  it('reads a PKCE authorization code', () => {
    expect(parseAuthCallbackUrl(`${AUTH_REDIRECT_URL}?code=pkce-code`)).toEqual(
      { kind: 'pkce', code: 'pkce-code' },
    );
  });

  it('keeps unrelated links outside the auth boundary', () => {
    expect(parseAuthCallbackUrl('pockettrainer://lesson/strength-1')).toEqual({
      kind: 'none',
    });
    expect(
      parseAuthCallbackUrl('pockettrainer://auth/callback/extra?code=code'),
    ).toEqual({ kind: 'none' });
  });

  it('surfaces provider errors without treating them as a session', () => {
    expect(
      parseAuthCallbackUrl(
        `${AUTH_REDIRECT_URL}?error=access_denied&error_description=Cancelled`,
      ),
    ).toEqual({ kind: 'error', message: 'Cancelled' });
  });

  it('rejects incomplete or empty callbacks explicitly', () => {
    expect(
      parseAuthCallbackUrl(`${AUTH_REDIRECT_URL}#access_token=access`),
    ).toEqual({
      kind: 'error',
      message: 'Callback autentikasi tidak memiliki sesi yang lengkap.',
    });
    expect(parseAuthCallbackUrl(AUTH_REDIRECT_URL)).toEqual({
      kind: 'error',
      message: 'Callback autentikasi tidak memiliki kode login.',
    });
  });

  it('rejects malformed callback URLs without throwing', () => {
    expect(parseAuthCallbackUrl('not a valid URL')).toEqual({
      kind: 'error',
      message: 'Callback autentikasi tidak valid.',
    });
  });
});
