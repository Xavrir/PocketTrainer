import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../app.module';
import { ApiExceptionFilter } from '../common/api-exception.filter';

describe('nutrition REST surface', () => {
  let app: INestApplication;
  const fetchMock = vi.fn();
  const auth = { 'x-dev-auth-subject': randomUUID() };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATA_STORE = 'memory';
    process.env.ALLOW_INSECURE_DEV_AUTH = 'true';
    delete process.env.GEMINI_API_KEY;
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify({ status: 1, product: { code: '0036000291452', product_name: 'Demo Protein Bar', brands: 'Demo', serving_size: '1 bar (50 g)', nutriments: { 'energy-kcal_serving': 190, proteins_serving: 12, carbohydrates_serving: 18, fat_serving: 7, fiber_serving: 3, sugars_serving: 5, sodium_serving: 0.2 } } }),
    });
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterAll(async () => { vi.unstubAllGlobals(); if (app) await app.close(); });

  it('returns a clear disabled response for the optional Gemini endpoint', async () => {
    await request(app.getHttpServer()).post('/v1/foods/candidates').set(auth).send({ label: 'Example cereal' }).expect(501).expect(({ body }) => {
      expect(body.error.code).toBe('GEMINI_FALLBACK_DISABLED');
    });
  });

  it('returns the same explicit disabled response for image candidates', async () => {
    await request(app.getHttpServer()).post('/v1/foods/candidates/image').set(auth).send({
      imageBase64: 'aGVsbG8=',
      mimeType: 'image/jpeg',
    }).expect(501).expect(({ body }) => {
      expect(body.error.code).toBe('GEMINI_FALLBACK_DISABLED');
    });
  });

  it('rejects invalid barcode input before contacting Open Food Facts', async () => {
    fetchMock.mockClear();
    await request(app.getHttpServer()).get('/v1/foods/barcodes/1234567890123').set(auth).expect(400).expect(({ body }) => {
      expect(body.error.code).toBe('INVALID_REQUEST');
    });
    await request(app.getHttpServer()).get('/v1/foods/barcodes/01234565').set(auth).expect(400);
    await request(app.getHttpServer()).get('/v1/foods/barcodes/123456').set(auth).expect(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('expands a distinguishable UPC-E value before Open Food Facts lookup', async () => {
    const canonicalBarcode = '0042000001007';
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify({ status: 1, product: { code: canonicalBarcode, product_name: 'UPC-E Demo Food', brands: 'Demo', serving_size: '1 package', nutriments: { 'energy-kcal_serving': 100, proteins_serving: 2, carbohydrates_serving: 20, fat_serving: 1 } } }),
    });

    const lookedUp = await request(app.getHttpServer()).get('/v1/foods/barcodes/04210007').set(auth).expect(200);
    expect(lookedUp.body).toMatchObject({ barcode: canonicalBarcode, source: 'open_food_facts', authoritative: true, persisted: true });
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain(`/api/v2/product/${canonicalBarcode}.json`);
  });

  it('looks up a packaged barcode and supports food-entry CRUD plus daily totals', async () => {
    const lookedUp = await request(app.getHttpServer()).get('/v1/foods/barcodes/0360-0029-1452').set(auth).expect(200);
    expect(lookedUp.body).toMatchObject({ barcode: '0036000291452', source: 'open_food_facts', authoritative: true, persisted: true });

    const custom = await request(app.getHttpServer()).post('/v1/foods/custom').set(auth).set('Idempotency-Key', randomUUID()).send({
      name: 'Test rice', serving: { amount: 100, unit: 'g' }, nutritionPerServing: { caloriesKcal: 130, proteinG: 2.7, carbohydrateG: 28, fatG: 0.3 },
    }).expect(201).expect(({ body }) => expect(body.authoritative).toBe(false));
    const entry = await request(app.getHttpServer()).post('/v1/food-entries').set(auth).set('Idempotency-Key', randomUUID()).send({
      foodId: custom.body.id, servings: 2, consumedAt: '2026-07-17T12:00:00+07:00', mealType: 'lunch',
    }).expect(201);
    await request(app.getHttpServer()).get(`/v1/food-entries/${entry.body.id}`).set(auth).expect(200);
    await request(app.getHttpServer()).get('/v1/food-entries?date=2026-07-17&timezone=Asia%2FJakarta').set(auth).expect(200).expect(({ body }) => expect(body).toHaveLength(1));
    await request(app.getHttpServer()).get('/v1/nutrition/daily?date=2026-07-17&timezone=Asia%2FJakarta').set(auth).expect(200).expect(({ body }) => expect(body.totals.caloriesKcal).toBe(260));
    await request(app.getHttpServer()).put(`/v1/food-entries/${entry.body.id}`).set(auth).set('Idempotency-Key', randomUUID()).send({ servings: 1 }).expect(200);
    await request(app.getHttpServer()).delete(`/v1/food-entries/${entry.body.id}`).set(auth).set('Idempotency-Key', randomUUID()).expect(200).expect(({ body }) => expect(body.deleted).toBe(true));
  });
});
