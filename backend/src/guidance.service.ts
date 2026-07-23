import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiContextService, AiSource } from './ai-context.service';
import { ApiException } from './common/api-exception';
import type { AuthenticatedUser } from './common/authenticated-user';

const requestSchema = z.object({
  topic: z.string().trim().min(1).max(500),
});

@Injectable()
export class GuidanceService {
  constructor(private readonly contextService: AiContextService) {}

  async getGuidance(
    user: AuthenticatedUser,
    request: {
      topic?: string;
      grade?: unknown;
      department?: unknown;
    },
  ) {
    const parsed = requestSchema.safeParse({ topic: request?.topic });
    if (!parsed.success) {
      throw new ApiException(
        'INVALID_GUIDANCE_REQUEST',
        '가이드 주제는 1자 이상 500자 이하로 입력해 주세요.',
        400,
      );
    }

    const context = await this.contextService.build(user);
    const topic = parsed.data.topic;
    const relevantNotices = context.notices
      .filter((notice) =>
        `${notice.title} ${notice.category} ${notice.summary}`
          .toLowerCase()
          .includes(topic.toLowerCase()),
      )
      .slice(0, 2);
    const notices =
      relevantNotices.length > 0
        ? relevantNotices
        : context.notices.slice(0, 2);
    const schedule = context.schedules[0];
    const sources: AiSource[] = notices.map((notice) => ({
      type: 'NOTICE',
      id: notice.id,
      title: notice.title,
      date: (notice.deadlineAt || notice.publishedAt).slice(0, 10),
    }));
    if (schedule) {
      sources.push({
        type: 'SCHEDULE',
        id: schedule.id,
        title: schedule.title,
        date: schedule.scheduleDate,
      });
    }

    const studentLabel = [
      context.student.grade ? `${context.student.grade}학년` : null,
      context.student.majorLabel,
      context.student.specialty,
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      status: 'OK',
      data: {
        title: `${topic} 가이드`,
        category: 'personalized',
        answer:
          sources.length > 0
            ? `${studentLabel || '학생'} 기준으로 "${topic}" 준비에 참고할 공지와 일정을 모았어요. 먼저 근거 자료의 대상, 마감일, 최신 버전을 확인해 주세요.`
            : `${studentLabel || '학생'} 기준의 "${topic}" 관련 자료를 찾지 못했습니다. 담당 부서의 최신 공지를 확인해 주세요.`,
        sources: sources.slice(0, 3),
      },
    };
  }
}
