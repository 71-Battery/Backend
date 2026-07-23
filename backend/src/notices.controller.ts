import { Controller, Get, UseGuards } from '@nestjs/common';
import { BearerAuthGuard } from './bearer-auth.guard';
import type { AuthenticatedUser } from './common/authenticated-user';
import { CurrentUser } from './common/current-user.decorator';
import { ContentService } from './content.service';

@Controller('api/notices')
@UseGuards(BearerAuthGuard)
export class NoticesController {
  constructor(private readonly content: ContentService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return {
      status: 'OK',
      data: {
        notices: await this.content.getNotices(user),
      },
    };
  }
}
