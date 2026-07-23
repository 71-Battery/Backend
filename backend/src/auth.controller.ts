import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { BearerAuthGuard } from './bearer-auth.guard';

type LoginRequest = {
  email?: string;
  password?: string;
};

type SignupRequest = LoginRequest & {
  name?: string;
  studentNumber?: unknown;
  agreements?: unknown;
};

type ResendVerificationRequest = {
  email?: string;
};

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signup(@Body() body: SignupRequest) {
    return this.authService.signup(
      body?.email || '',
      body?.password || '',
      body?.name || '',
      body?.studentNumber,
      body?.agreements,
    );
  }

  @Post('login')
  login(@Body() body: LoginRequest) {
    return this.authService.login(body?.email || '', body?.password || '');
  }

  @Post('resend-verification')
  resendVerification(@Body() body: ResendVerificationRequest) {
    return this.authService.resendVerification(body?.email || '');
  }

  @Post('logout')
  @UseGuards(BearerAuthGuard)
  @HttpCode(204)
  async logout(@Headers('authorization') authorization = '') {
    const token = authorization.slice('Bearer '.length).trim();
    await this.authService.logout(token);
  }

  @Get('confirmation')
  @UseGuards(BearerAuthGuard)
  @HttpCode(204)
  confirmation() {}
}
