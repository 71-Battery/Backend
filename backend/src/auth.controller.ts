import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

class LoginRequestDto {
  email?: string;
  password?: string;
}

class SignupRequestDto {
  email?: string;
  password?: string;
  name?: string;
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signup(@Body() dto: SignupRequestDto) {
    return this.authService.signup(dto?.email || '', dto?.password || '', dto?.name || '');
  }

  @Post('login')
  login(@Body() dto: LoginRequestDto) {
    return this.authService.login(dto?.email || '', dto?.password || '');
  }
}
