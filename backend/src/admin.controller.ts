import { Body, Controller, Get, Post } from '@nestjs/common';
import { StorageService } from './storage.service';

class AdminRuleDto {
  title?: string;
  content?: string;
  category?: string;
}

@Controller('api/admin')
export class AdminController {
  constructor(private readonly storageService?: StorageService) {}

  private readonly rules: Array<{ title: string; content: string; category: string }> = [];

  @Get('rules')
  getRules() {
    return {
      status: 'success',
      rules: this.rules,
    };
  }

  @Post('rules')
  async createRule(@Body() dto: AdminRuleDto) {
    const rule = {
      title: dto?.title || '제목 없음',
      content: dto?.content || '',
      category: dto?.category || 'general',
    };

    this.rules.push(rule);
    if (this.storageService) {
      await this.storageService.saveRule(rule);
    }

    return {
      status: 'success',
      rule,
    };
  }
}
