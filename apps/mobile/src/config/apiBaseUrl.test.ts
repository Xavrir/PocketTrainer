import { resolveApiBaseUrl } from './apiBaseUrl';

describe('mobile API base URL policy', () => {
  it('keeps explicit emulator and loopback URLs available in development', () => {
    expect(resolveApiBaseUrl('http://10.0.2.2:3000/', false)).toEqual({
      value: 'http://10.0.2.2:3000',
    });
    expect(resolveApiBaseUrl('http://127.0.0.1:3000', false)).toEqual({
      value: 'http://127.0.0.1:3000',
    });
  });

  it.each([
    'http://10.0.2.2:3000',
    'https://127.0.0.1:3000',
    'https://192.168.1.20:3000',
    'https://api.local',
    'https://temporary-name.trycloudflare.com',
    'http://api.pockettrainer.example',
  ])('rejects %s as a release endpoint', value => {
    expect(resolveApiBaseUrl(value, true)).toMatchObject({
      error: expect.stringMatching(/stable public HTTPS origin/i),
      value: '',
    });
  });

  it.each([
    'https://pockettrainer-api.example.azurecontainerapps.io',
    'https://api.pockettrainer.example',
  ])('accepts stable HTTPS release endpoint %s', value => {
    expect(resolveApiBaseUrl(value, true)).toEqual({ value });
  });

  it('rejects malformed or credential-bearing URLs in every build', () => {
    expect(resolveApiBaseUrl('not-a-url', false).error).toMatch(/valid/i);
    expect(
      resolveApiBaseUrl('https://user:secret@example.com', false).error,
    ).toMatch(/without credentials/i);
  });
});
