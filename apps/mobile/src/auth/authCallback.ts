export const AUTH_REDIRECT_URL = 'pockettrainer://auth/callback';

export type AuthCallback =
  | { kind: 'none' }
  | { kind: 'error'; message: string }
  | { kind: 'pkce'; code: string };

function parametersFrom(url: URL): URLSearchParams {
  const parameters = new URLSearchParams(url.search);
  const fragment = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const fragmentParameters = new URLSearchParams(fragment);
  fragmentParameters.forEach((value, key) => {
    if (!parameters.has(key)) parameters.set(key, value);
  });
  return parameters;
}

export function parseAuthCallbackUrl(url: string): AuthCallback {
  try {
    const callbackUrl = new URL(url);
    if (
      callbackUrl.protocol !== 'pockettrainer:' ||
      callbackUrl.hostname !== 'auth' ||
      callbackUrl.pathname !== '/callback'
    ) {
      return { kind: 'none' };
    }
    const parameters = parametersFrom(callbackUrl);
    const error =
      parameters.get('error_description') ?? parameters.get('error');
    if (error) return { kind: 'error', message: error };

    const code = parameters.get('code');
    if (code) return { kind: 'pkce', code };

    if (
      parameters.has('access_token') ||
      parameters.has('refresh_token')
    ) {
      return {
        kind: 'error',
        message: 'Callback autentikasi harus menggunakan kode PKCE.',
      };
    }

    return {
      kind: 'error',
      message: 'Callback autentikasi tidak memiliki kode login.',
    };
  } catch {
    return { kind: 'error', message: 'Callback autentikasi tidak valid.' };
  }
}
