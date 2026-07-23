import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

type LoginRequest = {
  email?: string;
  password?: string;
};

type SignupRequest = LoginRequest & {
  name?: string;
  studentNumber?: unknown;
  agreements?: unknown;
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
}
