import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Agent, type Dispatcher } from 'undici';
import { ApiException } from '../common/api-exception';
import {
  CampusAiProfile,
  CampusAiResponse,
  campusAiErrorSchema,
  campusAiResponseSchema,
} from './campus-ai.schemas';

const MAX_RESPONSE_BYTES = 1_000_000;

type CampusAiErrorDefinition = {
  status: number;
  message: string;
};

const CAMPUS_AI_ERRORS: Record<string, CampusAiErrorDefinition> = {
  KNOWLEDGE_BASE_UNAVAILABLE: {
    status: 503,
    message:
      '지식베이스를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.',
  },
  AI_PROVIDER_UNAVAILABLE: {
    status: 502,
    message: 'AI 답변 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  },
  CAMPUS_AI_UNAVAILABLE: {
    status: 503,
    message: 'AI 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  },
  CAMPUS_AI_TIMEOUT: {
    status: 504,
    message: 'AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.',
  },
  INVALID_AI_RESPONSE: {
    status: 502,
    message: 'AI 서버에서 올바르지 않은 응답을 반환했습니다.',
  },
};

@Injectable()
export class CampusAiClient implements OnModuleDestroy {
  private readonly baseUrl = process.env.CAMPUS_AI_API_URL?.trim() || '';
  private readonly topK = this.parseInteger(
    process.env.CAMPUS_AI_TOP_K,
    4,
    1,
    20,
  );
  private readonly scoreThreshold = this.parseNumber(
    process.env.CAMPUS_AI_SCORE_THRESHOLD,
    1.5,
    0,
    100,
  );
  private readonly connectTimeoutMs =
    this.parseInteger(
      process.env.CAMPUS_AI_CONNECT_TIMEOUT,
      5,
      1,
      30,
    ) * 1000;
  private readonly readTimeoutMs =
    this.parseInteger(
      process.env.CAMPUS_AI_READ_TIMEOUT,
      60,
      5,
      120,
    ) * 1000;
  private readonly dispatcher: Dispatcher = new Agent({
    connectTimeout: this.connectTimeoutMs,
    headersTimeout: this.readTimeoutMs,
    bodyTimeout: this.readTimeoutMs,
  });

  async onModuleDestroy() {
    await this.dispatcher.close();
  }

  async chat(
    query: string,
    trustedProfile: CampusAiProfile,
  ): Promise<CampusAiResponse> {
    const url = this.chatUrl();
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.connectTimeoutMs + this.readTimeoutMs,
    );

    let response: Response;
    let rawBody: string;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          grade: trustedProfile.grade,
          department: trustedProfile.department,
          top_k: this.topK,
          score_threshold: this.scoreThreshold,
        }),
        redirect: 'error',
        signal: controller.signal,
        dispatcher: this.dispatcher,
      } as RequestInit & { dispatcher: Dispatcher });
      const contentLength = Number(response.headers.get('content-length'));
      if (
        Number.isFinite(contentLength) &&
        contentLength > MAX_RESPONSE_BYTES
      ) {
        this.invalidResponse();
      }
      rawBody = await response.text();
      if (Buffer.byteLength(rawBody, 'utf8') > MAX_RESPONSE_BYTES) {
        this.invalidResponse();
      }
    } catch (error) {
      if (error instanceof ApiException) throw error;
      this.rethrowFetchError(error, controller);
    } finally {
      clearTimeout(timeout);
    }

    const payload = this.parseJson(rawBody);
    if (!response.ok) {
      this.throwUpstreamError(payload);
    }

    const parsed = campusAiResponseSchema.safeParse(payload);
    if (!parsed.success) this.invalidResponse();

    // The upstream profile is validated but never trusted. The authenticated
    // server-side profile is the only profile returned to the browser.
    return {
      ...parsed.data,
      profile: trustedProfile,
    };
  }

  private chatUrl() {
    let url: URL;
    try {
      url = new URL(
        `${this.baseUrl.replace(/\/+$/, '')}/v1/chat`,
      );
    } catch {
      throw new ApiException(
        'CAMPUS_AI_NOT_CONFIGURED',
        'AI 서버 연결 정보가 구성되지 않았습니다.',
        503,
      );
    }

    if (
      (url.protocol !== 'https:' && url.protocol !== 'http:') ||
      url.hostname.endsWith('.example.com') ||
      url.username ||
      url.password
    ) {
      throw new ApiException(
        'CAMPUS_AI_NOT_CONFIGURED',
        'AI 서버 연결 정보가 구성되지 않았습니다.',
        503,
      );
    }
    const isLoopback =
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]';
    if (
      url.protocol === 'http:' &&
      (process.env.NODE_ENV === 'production' || !isLoopback)
    ) {
      throw new ApiException(
        'CAMPUS_AI_INSECURE_URL',
        'AI 서버는 안전한 HTTPS 연결로 구성해야 합니다.',
        503,
      );
    }
    return url;
  }

  private parseJson(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      this.invalidResponse();
    }
  }

  private throwUpstreamError(payload: unknown): never {
    const parsed = campusAiErrorSchema.safeParse(payload);
    if (!parsed.success) this.invalidResponse();

    const definition = CAMPUS_AI_ERRORS[parsed.data.error.code];
    if (!definition) this.invalidResponse(parsed.data.error.request_id);

    throw new ApiException(
      parsed.data.error.code,
      definition.message,
      definition.status,
      parsed.data.error.request_id,
    );
  }

  private rethrowFetchError(
    error: unknown,
    controller: AbortController,
  ): never {
    const causeCode =
      error instanceof Error &&
      'cause' in error &&
      error.cause &&
      typeof error.cause === 'object' &&
      'code' in error.cause
        ? String(error.cause.code)
        : '';
    if (
      controller.signal.aborted ||
      (error instanceof Error && error.name === 'AbortError') ||
      causeCode === 'UND_ERR_HEADERS_TIMEOUT' ||
      causeCode === 'UND_ERR_BODY_TIMEOUT'
    ) {
      throw new ApiException(
        'CAMPUS_AI_TIMEOUT',
        CAMPUS_AI_ERRORS.CAMPUS_AI_TIMEOUT.message,
        CAMPUS_AI_ERRORS.CAMPUS_AI_TIMEOUT.status,
      );
    }
    throw new ApiException(
      'CAMPUS_AI_UNAVAILABLE',
      CAMPUS_AI_ERRORS.CAMPUS_AI_UNAVAILABLE.message,
      CAMPUS_AI_ERRORS.CAMPUS_AI_UNAVAILABLE.status,
    );
  }

  private invalidResponse(requestId?: string): never {
    throw new ApiException(
      'INVALID_AI_RESPONSE',
      CAMPUS_AI_ERRORS.INVALID_AI_RESPONSE.message,
      CAMPUS_AI_ERRORS.INVALID_AI_RESPONSE.status,
      requestId,
    );
  }

  private parseInteger(
    value: string | undefined,
    fallback: number,
    minimum: number,
    maximum: number,
  ) {
    const parsed = Number(value ?? fallback);
    return Number.isInteger(parsed) &&
      parsed >= minimum &&
      parsed <= maximum
      ? parsed
      : fallback;
  }

  private parseNumber(
    value: string | undefined,
    fallback: number,
    minimum: number,
    maximum: number,
  ) {
    const parsed = Number(value ?? fallback);
    return Number.isFinite(parsed) &&
      parsed >= minimum &&
      parsed <= maximum
      ? parsed
      : fallback;
  }
}
