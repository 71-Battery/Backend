import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from './common/authenticated-user';
import { ContentService } from './content.service';
import { ProfileService } from './profile.service';
import { PublicSchedule, SchedulesService } from './schedules.service';

export type AiSource = {
  type: 'SCHEDULE' | 'NOTICE' | 'RULE';
  id: string;
  title: string;
  date: string | null;
};

export type AiContext = {
  student: {
    grade: number | null;
    major: string | null;
    majorLabel: string | null;
    specialty: string | null;
  };
  schedules: PublicSchedule[];
  notices: Array<{
    id: string;
    title: string;
    summary: string;
    category: string;
    publishedAt: string;
    deadlineAt: string | null;
  }>;
  regulations: Array<{
    id: string;
    title: string;
    summary: string;
    category: string;
    publishedAt: string;
  }>;
};

@Injectable()
export class AiContextService {
  constructor(
    private readonly profiles: ProfileService,
    private readonly schedules: SchedulesService,
    private readonly content: ContentService,
  ) {}

  async build(user: AuthenticatedUser): Promise<AiContext> {
    const profile = await this.profiles.resolve(user);
    const [scheduleResult, noticeResult, regulationResult] =
      await Promise.allSettled([
        this.schedules.list(user, undefined, undefined, profile),
        this.content.getNotices(user, profile),
        this.content.getRegulations(user, profile),
      ]);

    return {
      student: {
        grade: profile.profile.grade,
        major: profile.profile.major,
        majorLabel: profile.profile.majorLabel,
        specialty: profile.profile.specialty,
      },
      schedules:
        scheduleResult.status === 'fulfilled'
          ? scheduleResult.value.schedules.slice(0, 20)
          : [],
      notices:
        noticeResult.status === 'fulfilled'
          ? noticeResult.value.slice(0, 10).map((notice) => ({
              id: notice.id,
              title: notice.title,
              summary: notice.summary,
              category: notice.category,
              publishedAt: notice.publishedAt,
              deadlineAt: notice.deadlineAt,
            }))
          : [],
      regulations:
        regulationResult.status === 'fulfilled'
          ? regulationResult.value.slice(0, 10).map((regulation) => ({
              id: regulation.id,
              title: regulation.title,
              summary: regulation.summary,
              category: regulation.category,
              publishedAt: regulation.publishedAt,
            }))
          : [],
    };
  }
}
