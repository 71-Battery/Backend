import { Injectable } from '@nestjs/common';
import { RepositoryService } from './repository.service';

@Injectable()
export class StorageService {
  constructor(private readonly repositoryService?: RepositoryService) {}

  async saveChatLog(entry: { message: string; answer: string; grade?: string; department?: string }) {
    if (!this.repositoryService) {
      return {
        status: 'saved',
        storage: 'memory',
        entry,
      };
    }

    const result = await this.repositoryService.saveChatLog(entry);

    if (result.status === 'saved' || result.status === 'skipped') {
      return {
        status: 'saved',
        storage: result.storage || 'memory',
        entry,
      };
    }

    return result;
  }

  async saveRule(rule: { title: string; content: string; category?: string }) {
    return this.repositoryService.saveRule(rule);
  }
}
