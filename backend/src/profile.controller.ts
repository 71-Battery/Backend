import { Controller, Get, Headers } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/profile')
export class ProfileController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  async getProfile(@Headers('authorization') authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      return {
        status: 'error',
        message: '인증 토큰이 필요합니다.',
      };
    }

    const token = authorization.slice('Bearer '.length);
    const user = await this.authService.verifyToken(token);

    if (!user) {
      return {
        status: 'error',
        message: '유효하지 않은 토큰입니다.',
      };
    }

    return {
      status: 'success',
      user,
    };
  }
}
