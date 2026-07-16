import { Controller, Get, HttpStatus, Param } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/request-context';
import { PocketTrainerRepository } from '../repositories/pocket-trainer.repository';

@Controller('v1')
export class CatalogController {
  constructor(private readonly repository: PocketTrainerRepository) {}
  @Get('catalog') getCatalog() { return this.repository.getCatalog(); }
  @Get('courses/:id') async getCourse(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const result = await this.repository.getCourse(user.id, id);
    if (!result) throw new ApiError('COURSE_NOT_FOUND', 'Course was not found.', HttpStatus.NOT_FOUND);
    return result;
  }
}
