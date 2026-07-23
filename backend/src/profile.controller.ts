import { Controller, Get, UseGuards } from '@nestjs/common';
import { BearerAuthGuard } from './bearer-auth.guard';
import type { AuthenticatedUser } from './common/authenticated-user';
import { CurrentUser } from './common/current-user.decorator';
import { ProfileService } from './profile.service';

@Controller('api/profile')
@UseGuards(BearerAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    const resolved = await this.profileService.resolve(user);
    return {
      status: 'OK',
      data: {
        profile: resolved.profile,
        permissions: resolved.permissions,
      },
      meta: resolved.meta,
    };
  }
}
