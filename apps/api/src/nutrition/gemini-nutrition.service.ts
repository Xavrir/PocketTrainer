import { z } from 'zod';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { APP_CONFIG, type AppConfig } from '../config';
import { candidateInputSchema, imageCandidateInputSchema } from './nutrition.schemas';
import type { CandidateInput, ImageCandidateInput, NutritionFoodData } from './nutrition.types';

const geminiResponseSchema = z.object({
  candidates: z.array(z.object({
    content: z.object({
      parts: z.array(z.object({ text: z.string().max(100_000) })).min(1),
    }),
  })).min(1),
});

const generatedCandidateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  brand: z.string().trim().max(120).nullable().optional(),
  serving: z.object({
    amount: z.number().finite().positive().max(100_000),
    unit: z.string().trim().min(1).max(32),
    label: z.string().trim().max(80).nullable().optional(),
  }),
  nutritionPerServing: z.object({
    caloriesKcal: z.number().finite().min(0).max(100_000),
    proteinG: z.number().finite().min(0).max(10_000),
    carbohydrateG: z.number().finite().min(0).max(10_000),
    fatG: z.number().finite().min(0).max(10_000),
    fiberG: z.number().finite().min(0).max(10_000).default(0),
    sugarG: z.number().finite().min(0).max(10_000).default(0),
    sodiumMg: z.number().finite().min(0).max(100_000).default(0),
  }).strict(),
}).strict();

const generatedEnvelopeSchema = z.object({
  candidates: z.array(generatedCandidateSchema).min(1).max(5),
}).strict();

const geminiResponseSchemaHint = {
  type: 'OBJECT',
  properties: {
    candidates: {
      type: 'ARRAY',
      maxItems: 5,
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          brand: { type: 'STRING' },
          serving: {
            type: 'OBJECT',
            properties: {
              amount: { type: 'NUMBER' },
              unit: { type: 'STRING' },
              label: { type: 'STRING' },
            },
            required: ['amount', 'unit', 'label'],
            additionalProperties: false,
          },
          nutritionPerServing: {
            type: 'OBJECT',
            properties: {
              caloriesKcal: { type: 'NUMBER' },
              proteinG: { type: 'NUMBER' },
              carbohydrateG: { type: 'NUMBER' },
              fatG: { type: 'NUMBER' },
              fiberG: { type: 'NUMBER' },
              sugarG: { type: 'NUMBER' },
              sodiumMg: { type: 'NUMBER' },
            },
            required: ['caloriesKcal', 'proteinG', 'carbohydrateG', 'fatG', 'fiberG', 'sugarG', 'sodiumMg'],
            additionalProperties: false,
          },
        },
        required: ['name', 'brand', 'serving', 'nutritionPerServing'],
        additionalProperties: false,
      },
    },
  },
  required: ['candidates'],
  additionalProperties: false,
} as const;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Gemini did not return a JSON object.');
  return JSON.parse(fenced.slice(start, end + 1)) as unknown;
}

@Injectable()
export class GeminiNutritionService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async generateCandidates(input: CandidateInput): Promise<{ candidates: NutritionFoodData[]; warning: string }> {
    const parsedInput = candidateInputSchema.parse(input);
    return this.requestCandidates(
      [{ text: `Find up to 3 plausible candidates for this package label. ${JSON.stringify(parsedInput)}` }],
      parsedInput.barcode,
    );
  }

  async generateImageCandidates(input: ImageCandidateInput): Promise<{ candidates: NutritionFoodData[]; warning: string }> {
    const parsedInput = imageCandidateInputSchema.parse(input);
    const labelHint = parsedInput.label ? ` The user supplied this optional hint: ${parsedInput.label}` : '';
    return this.requestCandidates(
      [
        { inline_data: { mime_type: parsedInput.mimeType, data: parsedInput.imageBase64 } },
        { text: `Read the visible food or package label in this image and find up to 3 plausible nutrition candidates.${labelHint}` },
      ],
      null,
    );
  }

  private async requestCandidates(
    parts: ReadonlyArray<
      | { text: string }
      | { inline_data: { mime_type: ImageCandidateInput['mimeType']; data: string } }
    >,
    barcode: string | null | undefined,
  ): Promise<{ candidates: NutritionFoodData[]; warning: string }> {
    const apiKey = this.config.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new ApiError('GEMINI_FALLBACK_DISABLED', 'Gemini nutrition fallback is disabled. Configure GEMINI_API_KEY on the backend.', HttpStatus.NOT_IMPLEMENTED, true);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.NUTRITION_LOOKUP_TIMEOUT_MS);
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.config.GEMINI_MODEL)}:generateContent`;
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json', accept: 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: 'Estimate packaged-food nutrition from a user label. Return only JSON; never claim certainty. Do not invent a barcode.' }] },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema: geminiResponseSchemaHint,
          },
        }),
      });
      if (!response.ok) throw new ApiError('GEMINI_UNAVAILABLE', 'The Gemini nutrition fallback is temporarily unavailable.', HttpStatus.SERVICE_UNAVAILABLE, true);

      let payload: unknown;
      try { payload = await response.json(); } catch { throw this.invalidResponse(); }
      const envelope = geminiResponseSchema.safeParse(payload);
      if (!envelope.success) throw this.invalidResponse();
      const text = envelope.data.candidates[0]?.content.parts.map((part) => part.text).join('\n');
      if (!text) throw this.invalidResponse();
      let candidatePayload: unknown;
      try { candidatePayload = extractJson(text); } catch { throw this.invalidResponse(); }
      const generated = generatedEnvelopeSchema.safeParse(candidatePayload);
      if (!generated.success) throw this.invalidResponse();

      return {
        candidates: generated.data.candidates.map((candidate) => ({
          barcode: barcode ?? null,
          name: candidate.name,
          brand: candidate.brand ?? null,
          serving: { amount: candidate.serving.amount, unit: candidate.serving.unit, label: candidate.serving.label ?? null },
          nutritionPerServing: candidate.nutritionPerServing,
          source: 'gemini_unverified',
          authoritative: false,
        })),
        warning: 'AI-generated estimates are suggestions only. Verify the package label before using or saving them.',
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('GEMINI_UNAVAILABLE', 'The Gemini nutrition fallback is temporarily unavailable.', HttpStatus.SERVICE_UNAVAILABLE, true);
    } finally { clearTimeout(timeout); }
  }

  private invalidResponse(): ApiError {
    return new ApiError('GEMINI_INVALID_RESPONSE', 'The Gemini nutrition fallback returned an invalid candidate format.', HttpStatus.BAD_GATEWAY, true);
  }
}
