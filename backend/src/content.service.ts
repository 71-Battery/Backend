import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from './common/authenticated-user';
import { TtlCache } from './data-gsm/ttl-cache';
import { ProfileService, ResolvedProfile } from './profile.service';
import {
  NoticeRow,
  RegulationRow,
  RepositoryService,
} from './repository.service';

@Injectable()
export class ContentService {
  private readonly noticeCache = new TtlCache<NoticeRow[]>();
  private readonly regulationCache = new TtlCache<RegulationRow[]>();
  private readonly cacheTtlMs = 5 * 60 * 1000;

  constructor(
    private readonly repository: RepositoryService,
    private readonly profiles: ProfileService,
  ) {}

  async getNotices(user: AuthenticatedUser, profileResult?: ResolvedProfile) {
    let notices = this.noticeCache.get('published');
    if (!notices) {
      notices = await this.repository.getNotices();
      this.noticeCache.set('published', notices, this.cacheTtlMs);
    }
    const resolved = profileResult || (await this.profiles.resolve(user));
    return notices.map((notice) => ({
      ...notice,
      type: 'NOTICE' as const,
      reason: this.buildReason(notice, resolved.profile),
    }));
  }

  async getRegulations(
    user: AuthenticatedUser,
    profileResult?: ResolvedProfile,
  ) {
    let regulations = this.regulationCache.get('published');
    if (!regulations) {
      regulations = await this.repository.getRegulations();
      this.regulationCache.set('published', regulations, this.cacheTtlMs);
    }
    const resolved = profileResult || (await this.profiles.resolve(user));
    return regulations.map((regulation) => ({
      ...regulation,
      type: 'RULE' as const,
      reason: this.buildReason(regulation, resolved.profile),
    }));
  }

  invalidateNotices() {
    this.noticeCache.delete('published');
  }

  invalidateRegulations() {
    this.regulationCache.delete('published');
  }

  private buildReason(
    item: Pick<
      NoticeRow,
      'targetGrades' | 'targetMajors' | 'category' | 'deadlineAt'
    >,
    profile: {
      grade: number | null;
      major: string | null;
      interests: string[];
    },
  ) {
    const reasons: string[] = [];
    if (
      profile.grade !== null &&
      (item.targetGrades.length === 0 ||
        item.targetGrades.includes(profile.grade))
    ) {
      reasons.push(`현재 ${profile.grade}학년`);
    }
    if (
      profile.major &&
      item.targetMajors.length > 0 &&
      item.targetMajors.includes(profile.major)
    ) {
      reasons.push('소속 학과');
    }
    if (
      profile.interests.some((interest) =>
        item.category.toLowerCase().includes(interest.toLowerCase()),
      )
    ) {
      reasons.push('관심 분야');
    }

    const subject = reasons.length > 0 ? reasons.join('·') : '학교생활';
    const deadline = item.deadlineAt ? '이며 마감일을 확인해야 하는' : '과 관련된';
    return `${subject}${deadline} ${item.category} 정보예요.`;
  }
}
