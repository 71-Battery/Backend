import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { BearerAuthGuard } from './bearer-auth.guard';
import type { AuthenticatedUser } from './common/authenticated-user';
import { CurrentUser } from './common/current-user.decorator';
import { GuidanceService } from './guidance.service';

type GuidanceRequest = {
  topic?: string;
  grade?: unknown;
  department?: unknown;
};

@Controller('api/guidance')
@UseGuards(BearerAuthGuard)
export class GuidanceController {
  constructor(private readonly guidanceService: GuidanceService) {}

  @Post()
  getGuidance(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GuidanceRequest,
  ) {
    return this.guidanceService.getGuidance(user, body);
  }
}
