import { Body, Controller, Delete, Get, Headers, Inject, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/current-user.decorator';
import { sendIdempotent } from '../common/idempotency';
import type { AuthenticatedUser } from '../common/request-context';
import { parseBody, requireIdempotencyKey } from '../common/zod';
import { NutritionService } from './nutrition.service';
import { barcodeSchema, candidateInputSchema, customFoodSchema, dailyNutritionQuerySchema, foodEntryQuerySchema, foodEntrySchema, imageCandidateInputSchema, updateFoodEntrySchema } from './nutrition.schemas';

@Controller('v1')
export class NutritionController {
  constructor(@Inject(NutritionService) private readonly service: NutritionService) {}

  @Get('foods/barcodes/:barcode')
  getBarcode(@CurrentUser() user: AuthenticatedUser, @Param('barcode') rawBarcode: string) { return this.service.getBarcode(user.id, parseBody(barcodeSchema, rawBarcode)); }

  @Post('foods/custom')
  async createCustom(@CurrentUser() user: AuthenticatedUser, @Headers('idempotency-key') rawKey: string | undefined, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const parsed = parseBody(customFoodSchema, body);
    return sendIdempotent(response, await this.service.createCustomFood(user.id, requireIdempotencyKey(rawKey), {
      ...parsed,
      nutritionPerServing: { ...parsed.nutritionPerServing, fiberG: parsed.nutritionPerServing.fiberG ?? 0, sugarG: parsed.nutritionPerServing.sugarG ?? 0, sodiumMg: parsed.nutritionPerServing.sodiumMg ?? 0 },
    }));
  }

  @Post('foods/candidates')
  generateCandidates(@CurrentUser() _user: AuthenticatedUser, @Body() body: unknown) {
    return this.service.generateCandidates(parseBody(candidateInputSchema, body));
  }

  @Post('foods/candidates/image')
  generateImageCandidates(@CurrentUser() _user: AuthenticatedUser, @Body() body: unknown) {
    return this.service.generateImageCandidates(parseBody(imageCandidateInputSchema, body));
  }

  @Get('food-entries')
  listEntries(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const parsed = parseBody(foodEntryQuerySchema, query);
    return this.service.listFoodEntries(user.id, { date: parsed.date, timezone: parsed.timezone ?? 'Asia/Jakarta', limit: parsed.limit ?? 50 });
  }

  @Get('food-entries/:id')
  getEntry(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getFoodEntry(user.id, id);
  }

  @Post('food-entries')
  async createEntry(@CurrentUser() user: AuthenticatedUser, @Headers('idempotency-key') rawKey: string | undefined, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    return sendIdempotent(response, await this.service.createFoodEntry(user.id, requireIdempotencyKey(rawKey), parseBody(foodEntrySchema, body)));
  }

  @Put('food-entries/:id')
  async updateEntry(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('idempotency-key') rawKey: string | undefined, @Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    return sendIdempotent(response, await this.service.updateFoodEntry(user.id, id, requireIdempotencyKey(rawKey), parseBody(updateFoodEntrySchema, body)));
  }

  @Delete('food-entries/:id')
  async deleteEntry(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Headers('idempotency-key') rawKey: string | undefined, @Res({ passthrough: true }) response: Response) {
    return sendIdempotent(response, await this.service.deleteFoodEntry(user.id, id, requireIdempotencyKey(rawKey)));
  }

  @Get('nutrition/daily')
  daily(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const parsed = parseBody(dailyNutritionQuerySchema, query);
    return this.service.getDailyNutrition(user.id, parsed.date, parsed.timezone ?? 'Asia/Jakarta');
  }
}
