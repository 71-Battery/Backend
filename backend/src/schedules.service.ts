import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from './common/authenticated-user';
import { ApiException } from './common/api-exception';
import { DataGsmClient } from './data-gsm/data-gsm.client';
import type { DataGsmSchedule } from './data-gsm/data-gsm.schemas';
import { TtlCache } from './data-gsm/ttl-cache';
import { ProfileService, ResolvedProfile } from './profile.service';
import {
  calendarDayDifference,
  seoulCurrentAndNextMonthRange,
  seoulToday,
  validateDate,
} from './seoul-date.util';

export type PublicSchedule = {
  id: string;
  scheduleDate: string;
  title: string;
  description: string;
  category: string;
  targetGrades: number[];
  academicYear: string;
  school: {
    code: string;
    name: string;
    officeCode: string;
    officeName: string;
  };
  courseType: string | null;
  dayNightType: string | null;
  source: 'DATA_GSM';
  month: string;
  date: string;
  dday: string;
  target: string;
  tone: 'urgent' | 'warning' | 'accent' | 'neutral';
  importance: 'HIGH' | 'MEDIUM' | 'LOW';
};

@Injectable()
export class SchedulesService {
  private readonly cache = new TtlCache<DataGsmSchedule[]>();
  private readonly currentTtlMs =
    this.parseTtl(process.env.DATA_GSM_SCHEDULE_TTL_SECONDS, 3600) * 1000;

  constructor(
    private readonly dataGsm: DataGsmClient,
    private readonly profiles: ProfileService,
  ) {}

  defaultRange() {
    return seoulCurrentAndNextMonthRange();
  }

  async list(
    user: AuthenticatedUser,
    requestedFromDate?: string,
    requestedToDate?: string,
    resolvedProfile?: ResolvedProfile,
  ) {
    const defaults = this.defaultRange();
    const fromDate = requestedFromDate || defaults.fromDate;
    const toDate = requestedToDate || defaults.toDate;
    const from = validateDate(fromDate, 'fromDate');
    const to = validateDate(toDate, 'toDate');

    if (from.epoch > to.epoch || to.epoch - from.epoch > 366 * 86_400_000) {
      throw new ApiException(
        'INVALID_DATE_RANGE',
        '조회 기간은 시작일 이후 최대 366일까지 지정할 수 있습니다.',
        400,
      );
    }

    const resolved = resolvedProfile || (await this.profiles.resolve(user));
    const cacheKey = `${fromDate}:${toDate}`;
    let upstream = this.cache.get(cacheKey);
    if (!upstream) {
      upstream = await this.dataGsm.getSchedules(fromDate, toDate);
      const pastRange = toDate < seoulToday();
      this.cache.set(
        cacheKey,
        upstream,
        pastRange ? 24 * 60 * 60 * 1000 : this.currentTtlMs,
      );
    }

    const grade = resolved.profile.grade;
    const schedules = upstream
      .map((schedule) => this.mapSchedule(schedule, grade))
      .sort((a, b) => {
        const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return (
          rank[a.importance] - rank[b.importance] ||
          a.scheduleDate.localeCompare(b.scheduleDate)
        );
      });

    return {
      schedules,
      meta: {
        fromDate,
        toDate,
        timezone: 'Asia/Seoul',
        profileFallback: resolved.meta.fallback,
      },
    };
  }

  private mapSchedule(
    schedule: DataGsmSchedule,
    studentGrade: number | null,
  ): PublicSchedule {
    const [, month, day] = schedule.scheduleDate.split('-');
    const dayDifference = calendarDayDifference(schedule.scheduleDate);
    const fullSchool = [1, 2, 3].every((grade) =>
      schedule.targetGrades.includes(grade),
    );
    const personal =
      studentGrade !== null && schedule.targetGrades.includes(studentGrade);

    return {
      id: String(schedule.scheduleId),
      scheduleDate: schedule.scheduleDate,
      title: schedule.eventName,
      description: schedule.eventContent || '',
      category: schedule.dayCategory || '학사일정',
      targetGrades: [...schedule.targetGrades],
      academicYear: String(schedule.academicYear),
      school: {
        code: schedule.schoolCode,
        name: schedule.schoolName,
        officeCode: schedule.officeCode,
        officeName: schedule.officeName,
      },
      courseType: schedule.schoolCourseType,
      dayNightType: schedule.dayNightType,
      source: 'DATA_GSM',
      month: `${Number(month)}월`,
      date: `${Number(day)}일`,
      dday:
        dayDifference === 0
          ? 'D-DAY'
          : dayDifference > 0
            ? `D-${dayDifference}`
            : `D+${Math.abs(dayDifference)}`,
      target: this.targetLabel(schedule.targetGrades),
      tone:
        dayDifference >= 0 && dayDifference <= 2
          ? 'urgent'
          : dayDifference >= 3 && dayDifference <= 7
            ? 'warning'
            : dayDifference > 7 && (personal || fullSchool)
              ? 'accent'
              : 'neutral',
      importance: personal ? 'HIGH' : fullSchool ? 'MEDIUM' : 'LOW',
    };
  }

  private targetLabel(grades: number[]) {
    const normalized = [...new Set(grades)]
      .filter((grade) => grade >= 1 && grade <= 3)
      .sort();
    if (normalized.length === 3) return '전 학년';
    if (normalized.length === 0) return '대상 정보 없음';
    return `${normalized.join('·')}학년`;
  }

  private parseTtl(value: string | undefined, fallbackSeconds: number) {
    const parsed = Number(value || fallbackSeconds);
    return Number.isFinite(parsed) && parsed >= 300 && parsed <= 86400
      ? parsed
      : fallbackSeconds;
  }
}
