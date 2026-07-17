import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config';
import { normalizeBarcode } from './nutrition.schemas';
import { PackagedFoodService } from './packaged-food.service';

const upc = '036000291452';
const canonicalUpc = '0036000291452';

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function service(timeout = 500): PackagedFoodService {
  return new PackagedFoodService(loadConfig({
    NODE_ENV: 'test',
    DATA_STORE: 'memory',
    ALLOW_INSECURE_DEV_AUTH: 'true',
    OPEN_FOOD_FACTS_BASE_URL: 'https://world.openfoodfacts.org/',
    NUTRITION_LOOKUP_TIMEOUT_MS: String(timeout),
  }));
}

describe('PackagedFoodService', () => {
  it('normalizes UPC-A, distinguishable UPC-E, and EAN values before lookup', () => {
    expect(normalizeBarcode('0360-0029 1452')).toBe(canonicalUpc);
    expect(normalizeBarcode('04210007')).toBe('0042000001007');
    expect(normalizeBarcode('01000106')).toBe('0010000000016');
    expect(normalizeBarcode('01000018')).toBe('0010100000008');
    expect(normalizeBarcode('01000027')).toBe('0010200000007');
    expect(normalizeBarcode('01030036')).toBe('0010300000006');
    expect(normalizeBarcode('01001046')).toBe('0010010000006');
    expect(normalizeBarcode('400638-1333931')).toBe('4006381333931');
    expect(normalizeBarcode('96385074')).toBe('96385074');
  });

  it('rejects ambiguous UPC-E/EAN-8 values, six-digit UPC-E bodies, invalid characters, and bad check digits', () => {
    expect(normalizeBarcode('01234565')).toBeNull();
    expect(normalizeBarcode('01000039')).toBeNull();
    expect(normalizeBarcode('01000049')).toBeNull();
    expect(normalizeBarcode('123456')).toBeNull();
    expect(normalizeBarcode('1234567890123')).toBeNull();
    expect(normalizeBarcode('03600029145A')).toBeNull();
    expect(normalizeBarcode('1234567')).toBeNull();
    expect(normalizeBarcode('0036000291453')).toBeNull();
  });

  it('returns source-backed, authoritative food data for a normalized UPC', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      status: 1,
      product: {
        code: canonicalUpc,
        product_name: 'Demo Food',
        brands: 'Demo Foods,Other Brand',
        serving_size: '1 bar (50 g)',
        nutriments: {
          'energy-kcal_serving': 190,
          proteins_serving: 12,
          carbohydrates_serving: 18,
          fat_serving: 7,
          fiber_serving: 3,
          sugars_serving: 5,
          sodium_serving: 0.2,
        },
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const result = await service().lookup(canonicalUpc);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/api/v2/product/${canonicalUpc}.json`),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(result).toMatchObject({
        status: 'found',
        food: {
          barcode: canonicalUpc,
          source: 'open_food_facts',
          authoritative: true,
          brand: 'Demo Foods',
        },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('maps Open Food Facts not-found responses without leaking upstream details', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({}, 404)).mockResolvedValueOnce(response({ status: 0, product: {} }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      await expect(service().lookup(upc)).resolves.toEqual({ status: 'not_found' });
      await expect(service().lookup(upc)).resolves.toEqual({ status: 'not_found' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('fails closed for malformed success payloads and mismatched product codes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ status: 'unexpected' }))
      .mockResolvedValueOnce(response({ status: 1, product: { code: '4006381333931' } }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      await expect(service().lookup(canonicalUpc)).resolves.toEqual({ status: 'unavailable' });
      await expect(service().lookup(canonicalUpc)).resolves.toEqual({ status: 'unavailable' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('maps an upstream timeout to unavailable', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('upstream aborted'), { name: 'AbortError' })));
    }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      await expect(service(500).lookup(upc)).resolves.toEqual({ status: 'unavailable' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('fails closed when the upstream response exceeds the bounded JSON limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('x'.repeat(256 * 1024 + 1), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      await expect(service().lookup(upc)).resolves.toEqual({ status: 'unavailable' });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
