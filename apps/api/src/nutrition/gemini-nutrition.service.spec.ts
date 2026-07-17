import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { loadConfig } from '../config';
import { GeminiNutritionService } from './gemini-nutrition.service';

const validGeminiPayload = {
  candidates: [{
    content: {
      parts: [{ text: JSON.stringify({
        candidates: [{
          name: 'Example cereal',
          brand: 'Example Foods',
          serving: { amount: 40, unit: 'g', label: '1 bowl' },
          nutritionPerServing: {
            caloriesKcal: 150,
            proteinG: 4,
            carbohydrateG: 30,
            fatG: 2,
            fiberG: 3,
            sugarG: 8,
            sodiumMg: 120,
          },
        }],
      }) }],
    },
  }],
};

function createService(overrides: NodeJS.ProcessEnv = {}): GeminiNutritionService {
  return new GeminiNutritionService(loadConfig({
    NODE_ENV: 'test',
    DATA_STORE: 'memory',
    ALLOW_INSECURE_DEV_AUTH: 'true',
    GEMINI_API_KEY: 'backend-test-secret',
    ...overrides,
  }));
}

describe('Gemini nutrition fallback', () => {
  it('returns a clear disabled error without a backend key', async () => {
    const config = loadConfig({ NODE_ENV: 'test', DATA_STORE: 'memory', ALLOW_INSECURE_DEV_AUTH: 'true' });
    const service = new GeminiNutritionService(config);
    await expect(service.generateCandidates({ label: 'Example cereal' })).rejects.toMatchObject({
      response: { code: 'GEMINI_FALLBACK_DISABLED' },
      status: 501,
    });
  });

  it('requests text-only structured output and marks candidates unverified', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => validGeminiPayload });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const result = await createService().generateCandidates({ barcode: '036000291452', label: 'Example cereal' });
      const [url, request] = fetchMock.mock.calls[0] ?? [];
      const body = JSON.parse(String((request as RequestInit).body));

      expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
      expect((request as RequestInit).headers).toMatchObject({ 'x-goog-api-key': 'backend-test-secret' });
      expect(String(body.contents[0].parts[0].text)).toContain('Example cereal');
      expect(body).not.toHaveProperty('image');
      expect(body).not.toHaveProperty('inlineData');
      expect(body.generationConfig).toMatchObject({ responseMimeType: 'application/json' });
      expect(body.generationConfig.responseSchema).toMatchObject({ type: 'OBJECT', required: ['candidates'] });
      expect(result).toMatchObject({ warning: expect.stringContaining('Verify the package label') });
      expect(result.candidates[0]).toMatchObject({
        barcode: '0036000291452',
        source: 'gemini_unverified',
        authoritative: false,
        name: 'Example cereal',
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('sends image bytes inline to Gemini without changing the review-only provenance', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => validGeminiPayload });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const result = await createService().generateImageCandidates({
        imageBase64: 'aGVsbG8=',
        label: 'Example cereal package',
        mimeType: 'image/jpeg',
      });
      const [url, request] = fetchMock.mock.calls[0] ?? [];
      const body = JSON.parse(String((request as RequestInit).body));

      expect(url).toContain('/models/gemini-2.5-flash:generateContent');
      expect(body.contents[0].parts).toEqual([
        { inline_data: { data: 'aGVsbG8=', mime_type: 'image/jpeg' } },
        { text: expect.stringContaining('Example cereal package') },
      ]);
      expect(result.candidates[0]).toMatchObject({
        source: 'gemini_unverified',
        authoritative: false,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects malformed structured output without exposing upstream details', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"candidates":[{"name":"Only a name"}]}' }] } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      await expect(createService().generateCandidates({ label: 'Example cereal' })).rejects.toMatchObject({
        response: {
          code: 'GEMINI_INVALID_RESPONSE',
          message: 'The Gemini nutrition fallback returned an invalid candidate format.',
        },
        status: 502,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('maps upstream failures to a recoverable 503', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ secret: 'upstream detail' }) });
    vi.stubGlobal('fetch', fetchMock);

    try {
      await expect(createService().generateCandidates({ label: 'Example cereal' })).rejects.toMatchObject({
        response: {
          code: 'GEMINI_UNAVAILABLE',
          message: 'The Gemini nutrition fallback is temporarily unavailable.',
        },
        status: 503,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not call Gemini when the fallback is disabled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    try {
      await expect(new GeminiNutritionService(loadConfig({ NODE_ENV: 'test', DATA_STORE: 'memory', ALLOW_INSECURE_DEV_AUTH: 'true' })).generateCandidates({ label: 'Example cereal' })).rejects.toMatchObject({ status: 501 });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
