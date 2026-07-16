import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/request-context';
import { PocketTrainerRepository } from '../repositories/pocket-trainer.repository';

@Controller('v1/plans')
export class PlanController {
  constructor(private readonly repository: PocketTrainerRepository) {}
  @Get('current') async get(@CurrentUser() user: AuthenticatedUser) {
    const plan = await this.repository.getCurrentPlan(user.id);
    if (!plan) throw new ApiError('PLAN_NOT_FOUND', 'Complete the movement assessment to create a plan.', HttpStatus.NOT_FOUND, true);
    return plan;
  }
}
