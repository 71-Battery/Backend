import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { ContentAdminGuard } from './app-role.guard';
import { BearerAuthGuard } from './bearer-auth.guard';
import { ApiException } from './common/api-exception';
import type { AuthenticatedUser } from './common/authenticated-user';
import { CurrentUser } from './common/current-user.decorator';
import {
  sanitizeAdminContent,
  sanitizeAdminPlainText,
} from './content-sanitizer';
import { RepositoryService } from './repository.service';

const ruleSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(50_000),
  category: z.string().trim().min(1).max(100).default('일반'),
});

@Controller('api/admin')
@UseGuards(BearerAuthGuard, ContentAdminGuard)
export class AdminController {
  constructor(private readonly repository: RepositoryService) {}

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

    const rule = await this.repository.createRegulation({
      title: sanitized.data.title,
      content: sanitized.data.content,
      category: sanitized.data.category,
      userId: user.id,
    });
    return {
      status: 'OK',
      data: {
        rule,
        regulation: rule,
      },
    };
  }
}
