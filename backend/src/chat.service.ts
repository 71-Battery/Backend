import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { CampusAiClient } from './campus-ai/campus-ai.client';
import type { CampusAiResponse } from './campus-ai/campus-ai.schemas';
import { ApiException } from './common/api-exception';
import type { AuthenticatedUser } from './common/authenticated-user';
import { ProfileService } from './profile.service';

const conversationIdSchema = z.string().uuid();

type V1ChatRequest = {
  query?: unknown;
  grade?: unknown;
  department?: unknown;
  top_k?: unknown;
  score_threshold?: unknown;
};

type LegacyChatRequest = {
  message?: unknown;
  conversationId?: unknown;
  grade?: unknown;
  department?: unknown;
};

@Injectable()
export class ChatService {
  constructor(
    private readonly profiles: ProfileService,
    private readonly campusAi: CampusAiClient,
  ) {}

  async createV1Chat(
    user: AuthenticatedUser,
    request: V1ChatRequest,
  ): Promise<CampusAiResponse> {
    const query = this.parseQuery(request?.query);
    return this.askCampusAi(user, query);
  }

  async generateResponse(
    user: AuthenticatedUser,
    request: LegacyChatRequest,
  ) {
    const query = this.parseQuery(request?.message);
    const conversationId = this.parseConversationId(
      request?.conversationId,
    );
    const response = await this.askCampusAi(user, query);

    return {
      status: 'OK',
      data: {
        answer: response.answer,
        category: 'campus-ai',
        conversationId: conversationId || response.request_id,
        profile: response.profile,
        sources: response.sources,
        has_context: response.has_context,
        retrieval: response.retrieval,
        request_id: response.request_id,
      },
    };
  }

  private async askCampusAi(user: AuthenticatedUser, query: string) {
    let profile;
    try {
      profile = await this.profiles.resolveForAi(user);
    } catch (error) {
      if (
        error instanceof ApiException &&
        error.code === 'STUDENT_PROFILE_NOT_FOUND'
      ) {
        throw new ApiException(
          'USER_NOT_FOUND',
          '사용자 정보를 찾을 수 없습니다.',
          404,
        );
      }
      throw error;
    }

    return this.campusAi.chat(query, profile);
  }

  private parseQuery(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new ApiException(
        'INVALID_REQUEST',
        '질문을 입력해 주세요.',
        400,
      );
    }

    const query = value.trim();
    if (query.length > 1000) {
      throw new ApiException(
        'QUERY_TOO_LONG',
        '질문은 1,000자 이하로 입력해 주세요.',
        400,
      );
    }
    return query;
  }

  private parseConversationId(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = conversationIdSchema.safeParse(value);
    if (!parsed.success) {
      throw new ApiException(
        'INVALID_REQUEST',
        '대화 식별자가 올바르지 않습니다.',
        400,
      );
    }
    return parsed.data;
  }
}
