import { Injectable } from '@nestjs/common';
import { ApiException } from '../common/api-exception';
import {
  dataGsmSchedulesEnvelopeSchema,
  DataGsmSchedule,
  dataGsmStudentsEnvelopeSchema,
  DataGsmStudent,
} from './data-gsm.schemas';

@Injectable()
export class DataGsmClient {
  private readonly baseUrl =
    process.env.DATA_GSM_BASE_URL?.trim() || 'https://openapi.datagsm.kr';
  private readonly apiKey = process.env.DATA_GSM_API_KEY?.trim() || '';
  private readonly timeoutMs = this.parseTimeout(
    process.env.DATA_GSM_TIMEOUT_MS,
  );

  async getStudentByEmail(email: string): Promise<DataGsmStudent | null> {
    const payload = await this.request('/v1/students', {
      email,
      onlyEnrolled: 'true',
      page: '0',
      size: '1',
    });
    const parsed = dataGsmStudentsEnvelopeSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiException(
        'DATA_PROVIDER_INVALID_RESPONSE',
        '학생 정보 응답을 확인할 수 없습니다.',
        502,
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const exactMatches = parsed.data.data.students.filter(
      (student) => student.email.trim().toLowerCase() === normalizedEmail,
    );

    if (exactMatches.length === 0) return null;
    if (exactMatches.length > 1) {
      throw new ApiException(
        'DATA_PROVIDER_INVALID_RESPONSE',
        '학생 정보 응답을 확인할 수 없습니다.',
        502,
      );
    }
    return exactMatches[0];
  }

  async getSchedules(
    fromDate: string,
    toDate: string,
  ): Promise<DataGsmSchedule[]> {
    const payload = await this.request('/v1/neis/schedules', {
      fromDate,
      toDate,
    });
    const parsed = dataGsmSchedulesEnvelopeSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiException(
        'DATA_PROVIDER_INVALID_RESPONSE',
        '학사 일정 응답을 확인할 수 없습니다.',
        502,
      );
    }
    return parsed.data.data.schedules;
  }

  private async request(
    path: string,
    query: Record<string, string>,
  ): Promise<unknown> {
    if (!this.apiKey || this.apiKey === 'your-api-key-here') {
      throw new ApiException(
        'DATA_PROVIDER_NOT_CONFIGURED',
        '학사 정보 제공자가 구성되지 않았습니다.',
        503,
      );
    }

    let url: URL;
    try {
      url = new URL(path, this.baseUrl);
    } catch {
      throw new ApiException(
        'DATA_PROVIDER_NOT_CONFIGURED',
        '학사 정보 제공자가 구성되지 않았습니다.',
        503,
      );
    }
    if (
      url.protocol !== 'https:' ||
      (process.env.NODE_ENV === 'production' &&
        url.hostname !== 'openapi.datagsm.kr')
    ) {
      throw new ApiException(
        'DATA_PROVIDER_NOT_CONFIGURED',
        '학사 정보 제공자가 구성되지 않았습니다.',
        503,
      );
    }
    Object.entries(query).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-API-KEY': this.apiKey,
        },
        redirect: 'error',
        signal: controller.signal,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || controller.signal.aborted)
      ) {
        throw new ApiException(
          'DATA_PROVIDER_TIMEOUT',
          '학사 정보 제공자의 응답이 지연되고 있습니다.',
          504,
        );
      }
      throw new ApiException(
        'DATA_PROVIDER_UNAVAILABLE',
        '학사 정보를 불러올 수 없습니다.',
        503,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new ApiException(
          'DATA_PROVIDER_AUTH_ERROR',
          '학사 정보 제공자 인증에 문제가 발생했습니다.',
          502,
        );
      }
      if (response.status === 403) {
        throw new ApiException(
          'DATA_PROVIDER_PERMISSION_ERROR',
          '학사 정보 조회 권한을 확인할 수 없습니다.',
          502,
        );
      }
      if (response.status === 429) {
        throw new ApiException(
          'DATA_PROVIDER_RATE_LIMITED',
          '학사 정보 요청이 많아 잠시 후 다시 시도해 주세요.',
          503,
        );
      }
      throw new ApiException(
        'DATA_PROVIDER_UNAVAILABLE',
        '학사 정보를 불러올 수 없습니다.',
        503,
      );
    }

    try {
      return await response.json();
    } catch {
      throw new ApiException(
        'DATA_PROVIDER_INVALID_RESPONSE',
        '학사 정보 응답을 확인할 수 없습니다.',
        502,
      );
    }
  }

  private parseTimeout(value?: string) {
    const parsed = Number(value || 5000);
    return Number.isFinite(parsed) && parsed >= 1000 && parsed <= 30000
      ? parsed
      : 5000;
  }
}
