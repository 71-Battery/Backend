import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BearerAuthGuard } from './bearer-auth.guard';
import type { AuthenticatedUser } from './common/authenticated-user';
import { CurrentUser } from './common/current-user.decorator';
import { SchedulesService } from './schedules.service';

@Controller('api/schedules')
@UseGuards(BearerAuthGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  async getSchedules(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const result = await this.schedulesService.list(user, fromDate, toDate);
    return {
      status: 'OK',
      data: {
        schedules: result.schedules,
      },
      meta: result.meta,
    };
  }
}
