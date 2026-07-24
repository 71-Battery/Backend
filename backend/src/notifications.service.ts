import { Injectable } from '@nestjs/common';
import { CampusAiClient } from './campus-ai/campus-ai.client';
import type { CampusAiNotice } from './campus-ai/campus-ai.schemas';
import type { AuthenticatedUser } from './common/authenticated-user';
import {
  sanitizeAdminContent,
  sanitizeAdminPlainText,
} from './content-sanitizer';
import { ProfileService } from './profile.service';

const MAJOR_BY_DEPARTMENT: Record<string, string> = {
  소프트웨어개발과: 'SW_DEVELOPMENT',
  스마트IoT과: 'SMART_IOT',
  인공지능과: 'AI',
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly campusAi: CampusAiClient,
    private readonly profiles: ProfileService,
  ) {}

  async listForUser(user: AuthenticatedUser) {
    const [upstream, resolved] = await Promise.all([
      this.campusAi.listNotices(100),
      this.profiles.resolve(user),
    ]);
    const grade = resolved.profile.grade;
    const department = resolved.profile.department;

    return upstream.notices
      .filter(
        (notice) =>
          this.matchesGrade(notice.target_grade, grade) &&
          this.matchesDepartment(notice.target_department, department),
      )
      .slice(0, 50)
      .map((notice) => this.toPublicNotification(notice));
  }

  private toPublicNotification(notice: CampusAiNotice) {
    const targetGrades = this.targetGrades(notice.target_grade);
    const targetMajor = MAJOR_BY_DEPARTMENT[notice.target_department];
    const summary =
      sanitizeAdminPlainText(String(notice.summary || '')) ||
      sanitizeAdminPlainText(String(notice.content || '')) ||
      '새 공지가 등록되었습니다.';

    return {
      id: `ai-notice:${notice.id}`,
      sourceId: sanitizeAdminPlainText(String(notice.source_id || '')) || null,
      type: 'NOTICE' as const,
      title:
        sanitizeAdminPlainText(String(notice.title || '')) || '새 학교 알림',
      summary,
      content: sanitizeAdminContent(String(notice.content || summary)),
      category: notice.type === 'schedule' ? '일정 알림' : 'AI 알림',
      department: 'AI 공지 브리핑',
      publishedAt: String(notice.created_at),
      deadlineAt: this.isoTimestamp(notice.starts_at),
      targetGrades,
      targetMajors: targetMajor ? [targetMajor] : [],
      sourceUrl: this.safeSourceUrl(notice.url),
      version: 1,
      updatedAt: String(notice.created_at),
      isProactive: true,
      notified: notice.notified,
      summaryProvider:
        sanitizeAdminPlainText(String(notice.summary_provider || '')) || null,
      reason: notice.notified
        ? 'AI가 새 공지를 요약해 전달한 알림이에요.'
        : 'AI가 학생 대상에 맞춰 정리한 공지예요.',
    };
  }

  private matchesGrade(target: string, grade: number | null) {
    const normalized = String(target || '').trim();
    if (!normalized || /^(전체|전\s*학년|전체\s*학년)$/.test(normalized)) {
      return true;
    }
    if (grade === null) return false;
    return this.targetGrades(normalized).includes(grade);
  }

  private matchesDepartment(target: string, department: string | null) {
    const normalized = String(target || '').trim();
    if (!normalized || /^(전체|전체\s*학과)$/.test(normalized)) return true;
    if (!department) return false;
    return normalized
      .split(/[,/·]/)
      .map((item) => item.trim())
      .includes(department);
  }

  private targetGrades(target: string) {
    return [
      ...new Set(
        [...String(target || '').matchAll(/([1-3])\s*학년/g)].map((match) =>
          Number(match[1]),
        ),
      ),
    ];
  }

  private safeSourceUrl(value: string | null | undefined) {
    if (!value) return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
  }

  private isoTimestamp(value: string | null | undefined) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
}
