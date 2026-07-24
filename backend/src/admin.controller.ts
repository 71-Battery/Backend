import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { ContentAdminGuard, SystemAdminGuard } from './app-role.guard';
import { BearerAuthGuard } from './bearer-auth.guard';
import { CampusAiClient } from './campus-ai/campus-ai.client';
import { ApiException } from './common/api-exception';
import type { AuthenticatedUser } from './common/authenticated-user';
import { CurrentUser } from './common/current-user.decorator';
import {
  sanitizeAdminContent,
  sanitizeAdminPlainText,
} from './content-sanitizer';
import { ContentService } from './content.service';
import { RepositoryService } from './repository.service';

const ruleSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(50_000),
  category: z.string().trim().min(1).max(100).default('일반'),
});

const noticeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(500).default(''),
  content: z.string().trim().min(1).max(50_000),
  category: z.string().trim().min(1).max(100).default('일반'),
});

const userListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(10).max(50).default(20),
});

const appRoleSchema = z.object({
  appRole: z.enum(['STUDENT', 'CONTENT_EDITOR', 'ADMIN']),
});

function parseRule(body: unknown): {
  title: string;
  content: string;
  category: string;
} {
  const parsed = ruleSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiException(
      'INVALID_REGULATION',
      '규정 제목과 내용을 확인해 주세요.',
      400,
    );
  }

  const sanitized = ruleSchema.safeParse({
    title: sanitizeAdminPlainText(parsed.data.title),
    content: sanitizeAdminContent(parsed.data.content),
    category: sanitizeAdminPlainText(parsed.data.category),
  });
  if (!sanitized.success) {
    throw new ApiException(
      'INVALID_REGULATION',
      '규정 제목과 내용을 확인해 주세요.',
      400,
    );
  }
  return {
    title: String(sanitized.data.title),
    content: String(sanitized.data.content),
    category: String(sanitized.data.category),
  };
}

function parseNotice(body: unknown): {
  title: string;
  summary: string;
  content: string;
  category: string;
} {
  const parsed = noticeSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiException(
      'INVALID_NOTICE',
      '공지 제목과 내용을 확인해 주세요.',
      400,
    );
  }

  const sanitized = noticeSchema.safeParse({
    title: sanitizeAdminPlainText(parsed.data.title),
    summary: sanitizeAdminPlainText(parsed.data.summary),
    content: sanitizeAdminContent(parsed.data.content),
    category: sanitizeAdminPlainText(parsed.data.category),
  });
  if (!sanitized.success) {
    throw new ApiException(
      'INVALID_NOTICE',
      '공지 제목과 내용을 확인해 주세요.',
      400,
    );
  }
  return {
    title: String(sanitized.data.title),
    summary: String(sanitized.data.summary),
    content: String(sanitized.data.content),
    category: String(sanitized.data.category),
  };
}

@Controller('api/admin')
@UseGuards(BearerAuthGuard, ContentAdminGuard)
export class AdminController {
  constructor(
    private readonly repository: RepositoryService,
    private readonly campusAi?: CampusAiClient,
    private readonly content?: ContentService,
  ) {}

  @Get('rules')
  async getRules() {
    const rules = await this.repository.getRegulations();
    return {
      status: 'OK',
      data: {
        rules,
        regulations: rules,
      },
    };
  }

  @Post('rules')
  async createRule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const sanitized = parseRule(body);
    const rule = await this.repository.createRegulation({
      ...sanitized,
      userId: user.id,
    });
    this.content?.invalidateRegulations();
    return {
      status: 'OK',
      data: {
        rule,
        regulation: rule,
      },
    };
  }

  @Patch('rules/:ruleId')
  async updateRule(
    @Param('ruleId') ruleId: string,
    @Body() body: unknown,
  ) {
    const parsedId = z.string().uuid().safeParse(ruleId);
    if (!parsedId.success) {
      throw new ApiException(
        'INVALID_REGULATION',
        '수정할 규정을 확인해 주세요.',
        400,
      );
    }
    const sanitized = parseRule(body);
    const rule = await this.repository.updateRegulation(parsedId.data, sanitized);
    this.content?.invalidateRegulations();
    return {
      status: 'OK',
      data: {
        rule,
        regulation: rule,
      },
    };
  }

  @Delete('rules/:ruleId')
  async deleteRule(@Param('ruleId') ruleId: string) {
    const parsedId = z.string().uuid().safeParse(ruleId);
    if (!parsedId.success) {
      throw new ApiException(
        'INVALID_REGULATION',
        '삭제할 규정을 확인해 주세요.',
        400,
      );
    }
    await this.repository.deleteRegulation(parsedId.data);
    this.content?.invalidateRegulations();
    return {
      status: 'OK',
      data: { ruleId: parsedId.data },
    };
  }

  @Post('notices')
  async createNotice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const sanitized = parseNotice(body);
    const notice = await this.repository.createNotice({
      ...sanitized,
      userId: user.id,
    });
    this.content?.invalidateNotices();

    let notification: {
      status: 'DELIVERED' | 'SKIPPED' | 'DEFERRED';
      notified: boolean;
      channels: Array<{ channel: string; ok: boolean }>;
    } = {
      status: 'DEFERRED',
      notified: false,
      channels: [],
    };
    if (this.campusAi) {
      try {
        const result = await this.campusAi.ingestNotice({
          title: notice.title,
          content: notice.content,
          type: 'notice',
          sourceId: notice.id,
          url: notice.sourceUrl,
          targetGrade: '전체',
          targetDepartment: '전체',
        });
        notification = {
          status: result.skipped ? 'SKIPPED' : 'DELIVERED',
          notified: Boolean(result.notice?.notified),
          channels: result.notify_results.map((item) => ({
            channel: item.channel,
            ok: item.ok,
          })),
        };
      } catch {
        // The database notice is the source of truth. A temporary AI outage
        // must not roll back an already published school notice.
      }
    }
    return {
      status: 'OK',
      data: { notice, notification },
    };
  }

  @Get('users')
  @UseGuards(SystemAdminGuard)
  async getUsers(@Query() query: unknown) {
    const parsed = userListSchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiException(
        'INVALID_PAGINATION',
        '회원 목록 범위를 확인해 주세요.',
        400,
      );
    }
    const result = await this.repository.listAppUsers(
      parsed.data.page,
      parsed.data.perPage,
    );
    return {
      status: 'OK',
      data: {
        users: result.users,
        pagination: {
          page: parsed.data.page,
          perPage: parsed.data.perPage,
          total: result.total,
        },
      },
    };
  }

  @Patch('users/:userId/role')
  @UseGuards(SystemAdminGuard)
  async updateUserRole(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() body: unknown,
  ) {
    const parsedUserId = z.string().uuid().safeParse(userId);
    const parsedBody = appRoleSchema.safeParse(body);
    if (!parsedUserId.success || !parsedBody.success) {
      throw new ApiException(
        'INVALID_APP_ROLE',
        '사용자와 권한을 확인해 주세요.',
        400,
      );
    }
    if (parsedUserId.data === currentUser.id) {
      throw new ApiException(
        'SELF_ROLE_CHANGE_NOT_ALLOWED',
        '현재 로그인한 계정의 권한은 변경할 수 없습니다.',
        409,
      );
    }

    const profile = await this.repository.updateAppRole(
      parsedUserId.data,
      parsedBody.data.appRole,
    );
    return {
      status: 'OK',
      data: {
        userId: profile.userId,
        appRole: profile.appRole,
      },
    };
  }
}
