import {
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { BearerAuthGuard } from './bearer-auth.guard';
import { ApiException } from './common/api-exception';
import type { AuthenticatedUser } from './common/authenticated-user';
import { CurrentUser } from './common/current-user.decorator';
import {
  RepositoryService,
  ResourceType,
} from './repository.service';

const resourceTypeSchema = z.enum(['SCHEDULE', 'NOTICE', 'RULE']);
const resourceIdSchema = z.string().trim().min(1).max(200);

@Controller('api/saved-resources')
@UseGuards(BearerAuthGuard)
export class SavedResourcesController {
  constructor(private readonly repository: RepositoryService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return {
      status: 'OK',
      data: {
        savedResources: await this.repository.getSavedResources(user.id),
      },
    };
  }

  @Put(':resourceType/:resourceId')
  async save(
    @CurrentUser() user: AuthenticatedUser,
    @Param('resourceType') resourceTypeValue: string,
    @Param('resourceId') resourceIdValue: string,
  ) {
    const { resourceType, resourceId } = this.parseParams(
      resourceTypeValue,
      resourceIdValue,
    );
    return {
      status: 'OK',
      data: {
        savedResource: await this.repository.saveResource(
          user.id,
          resourceType,
          resourceId,
        ),
      },
    };
  }

  @Delete(':resourceType/:resourceId')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('resourceType') resourceTypeValue: string,
    @Param('resourceId') resourceIdValue: string,
  ) {
    const { resourceType, resourceId } = this.parseParams(
      resourceTypeValue,
      resourceIdValue,
    );
    await this.repository.deleteSavedResource(
      user.id,
      resourceType,
      resourceId,
    );
    return {
      status: 'OK',
      data: {
        removed: true,
        resourceType,
        resourceId,
      },
    };
  }

  private parseParams(resourceTypeValue: string, resourceIdValue: string) {
    const parsedType = resourceTypeSchema.safeParse(
      resourceTypeValue?.toUpperCase(),
    );
    const parsedId = resourceIdSchema.safeParse(resourceIdValue);
    if (!parsedType.success || !parsedId.success) {
      throw new ApiException(
        'INVALID_SAVED_RESOURCE',
        '저장할 정보의 유형과 식별자를 확인해 주세요.',
        400,
      );
    }
    return {
      resourceType: parsedType.data as ResourceType,
      resourceId: parsedId.data,
    };
  }
}
