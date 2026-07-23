import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

class LoginRequestDto {
  email?: string;
  password?: string;
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginRequestDto) {
    return this.authService.login(dto?.email?.trim() || '', dto?.password?.trim() || '');
  }
}
