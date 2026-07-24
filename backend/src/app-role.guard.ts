import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ApiException } from './common/api-exception';
import type { AuthenticatedUser } from './common/authenticated-user';
import { RepositoryService } from './repository.service';

@Injectable()
export class ContentAdminGuard implements CanActivate {
  constructor(private readonly repository: RepositoryService) {}

  async canActivate(context: ExecutionContext) {
    const user = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) {
      throw new ApiException('AUTH_REQUIRED', '인증이 필요합니다.', 401);
    }
    const profile = await this.repository.getAppProfile(user.id);
    if (profile.appRole !== 'ADMIN' && profile.appRole !== 'CONTENT_EDITOR') {
      throw new ApiException(
        'CONTENT_ADMIN_REQUIRED',
        '콘텐츠 관리 권한이 필요합니다.',
        403,
      );
    }
    return true;
  }
}

@Injectable()
export class SystemAdminGuard implements CanActivate {
  constructor(private readonly repository: RepositoryService) {}

  async canActivate(context: ExecutionContext) {
    const user = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) {
      throw new ApiException('AUTH_REQUIRED', '인증이 필요합니다.', 401);
    }

    const profile = await this.repository.getAppProfile(user.id);
    if (profile.appRole !== 'ADMIN') {
      throw new ApiException(
        'SYSTEM_ADMIN_REQUIRED',
        '관리자 권한이 필요합니다.',
        403,
      );
    }
    return true;
  }
}
