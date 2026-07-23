import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { ApiException } from './common/api-exception';
import type { AuthenticatedUser } from './common/authenticated-user';
import { DataGsmClient } from './data-gsm/data-gsm.client';
import type { DataGsmStudent } from './data-gsm/data-gsm.schemas';
import { TtlCache } from './data-gsm/ttl-cache';
import {
  AppProfileRow,
  ProfileFallbackRow,
  RepositoryService,
} from './repository.service';

const MAJOR_LABELS = {
  SW_DEVELOPMENT: '소프트웨어개발과',
  SMART_IOT: '스마트IoT과',
  AI: '인공지능과',
} as const;

export type PublicStudentProfile = {
  id: string | null;
  name: string | null;
  email: string;
  schoolEmail: string;
  grade: number | null;
  classNum: number | null;
  number: number | null;
  studentNumber: number | null;
  major: keyof typeof MAJOR_LABELS | null;
  majorLabel: string | null;
  department: string | null;
  specialty: string | null;
  role: string | null;
  interests: string[];
};

export type ResolvedProfile = {
  profile: PublicStudentProfile;
  permissions: {
    canManageContent: boolean;
  };
  appRole: AppProfileRow['appRole'];
  meta: {
    profileSource: 'DATA_GSM' | 'LOCAL_PROFILE';
    fallback: boolean;
  };
};

export type AiStudentProfile = {
  grade: string;
  department: string;
};

@Injectable()
export class ProfileService {
  private readonly cache = new TtlCache<{ student: DataGsmStudent | null }>();
  private readonly inFlight = new Map<
    string,
    Promise<DataGsmStudent | null>
  >();
  private readonly cacheSecret =
    process.env.CACHE_KEY_SECRET?.trim() ||
    randomBytes(32).toString('base64url');
  private readonly profileTtlMs =
    this.parseTtl(process.env.DATA_GSM_PROFILE_TTL_SECONDS, 300) * 1000;

  constructor(
    private readonly dataGsm: DataGsmClient,
    private readonly repository: RepositoryService,
  ) {}

  async resolve(user: AuthenticatedUser): Promise<ResolvedProfile> {
    const appProfile = await this.repository.getAppProfile(user.id);
    const cacheKey = this.profileCacheKey(user.email);
    const cached = this.cache.get(cacheKey);
    let student = cached?.student || null;
    let providerError: unknown;

    if (!cached) {
      try {
        student = await this.getStudentSingleFlight(cacheKey, user.email);
        // Successful "not found" results are cacheable. Provider auth and
        // response-validation failures reject before this point and are never
        // cached.
        this.cache.set(cacheKey, { student }, this.profileTtlMs);
        if (student) {
          try {
            await this.repository.saveProfileSnapshot(user.id, {
              id: String(student.id),
              name: student.name,
              grade: student.grade,
              classNum: student.classNum,
              number: student.number,
              studentNumber: student.studentNumber,
              major: student.major,
              specialty: student.specialty,
              role: student.role,
            });
          } catch {
            // A successful provider response remains usable even if refreshing
            // the optional local fallback snapshot fails.
          }
        }
      } catch (error) {
        providerError = error;
      }
    }

    if (student) {
      return {
        profile: this.mapStudent(student, user.email, appProfile.interests),
        permissions: {
          canManageContent:
            appProfile.appRole === 'ADMIN' ||
            appProfile.appRole === 'CONTENT_EDITOR',
        },
        appRole: appProfile.appRole,
        meta: {
          profileSource: 'DATA_GSM',
          fallback: false,
        },
      };
    }

    const fallback = await this.repository.getProfileFallback(user.id);
    if (fallback) {
      return {
        profile: this.mapFallback(fallback, user.email, appProfile.interests),
        permissions: {
          canManageContent:
            appProfile.appRole === 'ADMIN' ||
            appProfile.appRole === 'CONTENT_EDITOR',
        },
        appRole: appProfile.appRole,
        meta: {
          profileSource: 'LOCAL_PROFILE',
          fallback: true,
        },
      };
    }

    if (providerError) throw providerError;
    throw new ApiException(
      'STUDENT_PROFILE_NOT_FOUND',
      '등록된 학생 정보를 찾을 수 없습니다.',
      404,
    );
  }

  async resolveForAi(user: AuthenticatedUser): Promise<AiStudentProfile> {
    const resolved = await this.resolve(user);
    const grade = resolved.profile.grade;
    const department = resolved.profile.department?.trim();

    if (
      !Number.isInteger(grade) ||
      grade === null ||
      grade < 1 ||
      grade > 3 ||
      !department
    ) {
      throw new ApiException(
        'PROFILE_INCOMPLETE',
        'AI 질문을 사용하려면 학년과 학과 정보가 필요합니다.',
        400,
      );
    }

    return {
      grade: `${grade}학년`,
      department,
    };
  }

  private mapStudent(
    student: DataGsmStudent,
    email: string,
    interests: string[],
  ): PublicStudentProfile {
    const major = student.major;
    const majorLabel = major ? MAJOR_LABELS[major] : null;
    return {
      id: String(student.id),
      name: student.name,
      email,
      schoolEmail: email,
      grade: student.grade,
      classNum: student.classNum,
      number: student.number,
      studentNumber: student.studentNumber,
      major,
      majorLabel,
      department: majorLabel,
      specialty: student.specialty,
      role: student.role,
      interests,
    };
  }

  private mapFallback(
    fallback: ProfileFallbackRow,
    email: string,
    interests: string[],
  ): PublicStudentProfile {
    const majorLabel = fallback.major
      ? MAJOR_LABELS[fallback.major]
      : null;
    return {
      id: fallback.dataGsmStudentId,
      name: fallback.name,
      email,
      schoolEmail: email,
      grade: fallback.grade,
      classNum: fallback.classNum,
      number: fallback.number,
      studentNumber: fallback.studentNumber,
      major: fallback.major,
      majorLabel,
      department: majorLabel,
      specialty: fallback.specialty,
      role: fallback.dataGsmRole,
      interests,
    };
  }

  private profileCacheKey(email: string) {
    return createHmac('sha256', this.cacheSecret)
      .update(email.trim().toLowerCase())
      .digest('base64url');
  }

  private getStudentSingleFlight(cacheKey: string, email: string) {
    const existing = this.inFlight.get(cacheKey);
    if (existing) return existing;

    const request = this.dataGsm
      .getStudentByEmail(email)
      .finally(() => {
        if (this.inFlight.get(cacheKey) === request) {
          this.inFlight.delete(cacheKey);
        }
      });
    this.inFlight.set(cacheKey, request);
    return request;
  }

  private parseTtl(value: string | undefined, fallbackSeconds: number) {
    const parsed = Number(value || fallbackSeconds);
    return Number.isFinite(parsed) && parsed >= 30 && parsed <= 86400
      ? parsed
      : fallbackSeconds;
  }
}
