import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import { ApiException } from '../common/api-exception';
import type { AuthenticatedUser } from '../common/authenticated-user';

type AuthenticatedRequest = {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
};

@Injectable()
export class CampusChatAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new ApiException(
        'UNAUTHORIZED',
        '로그인이 필요합니다.',
        401,
      );
    }

    const token = authorization.slice('Bearer '.length).trim();
    const user = token
      ? await this.authService.verifyAccessToken(token)
      : null;
    if (!user) {
      throw new ApiException(
        'INVALID_TOKEN',
        '인증 정보가 만료되었거나 유효하지 않습니다.',
        401,
      );
    }

    request.user = user;
    return true;
  }
}
