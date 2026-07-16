/** @format */

import { isSupabasePublicKey, isSupabaseUrl } from '../src/auth/configuration';

function legacyJwt(role: string): string {
  const payloads: Record<string, string> = {
    anon: 'eyJyb2xlIjoiYW5vbiJ9',
    service_role: 'eyJyb2xlIjoic2VydmljZV9yb2xlIn0',
  };
  return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payloads[role]}.signature`;
}

describe('Supabase public configuration', () => {
  it('accepts current publishable keys and legacy anon JWTs', () => {
    expect(isSupabasePublicKey('sb_publishable_public-client-key')).toBe(true);
    expect(isSupabasePublicKey(legacyJwt('anon'))).toBe(true);
  });

  it('rejects server-only secret and legacy service-role keys', () => {
    expect(isSupabasePublicKey('sb_secret_server-only-key')).toBe(false);
    expect(isSupabasePublicKey(legacyJwt('service_role'))).toBe(false);
  });

  it('requires an HTTPS project URL but permits Supabase custom domains', () => {
    expect(isSupabaseUrl('https://auth.pockettrainer.example')).toBe(true);
    expect(isSupabaseUrl('http://auth.pockettrainer.example')).toBe(false);
    expect(isSupabaseUrl('not-a-url')).toBe(false);
  });
});
