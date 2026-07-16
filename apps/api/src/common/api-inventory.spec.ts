import { describe, expect, it } from 'vitest';
import { API_ENDPOINTS } from './api-inventory';

describe('typed REST inventory', () => {
  it('has unique method/path entries and requires idempotency for every mutation', () => {
    const keys = API_ENDPOINTS.map((endpoint) => `${endpoint.method} ${endpoint.path}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(API_ENDPOINTS.filter((endpoint) => endpoint.method !== 'GET').every((endpoint) => endpoint.idempotency === 'required')).toBe(true);
    expect(API_ENDPOINTS.find((endpoint) => endpoint.path === '/v1/privacy/export')?.authentication).toBe('bearer');
    expect(API_ENDPOINTS.find((endpoint) => endpoint.path === '/v1/privacy/account')?.method).toBe('DELETE');
  });
});
