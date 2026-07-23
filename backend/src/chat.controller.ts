import {
  Body,
  Controller,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { BearerAuthGuard } from './bearer-auth.guard';
import { CampusChatAuthGuard } from './campus-ai/campus-chat-auth.guard';
import { CampusChatExceptionFilter } from './campus-ai/campus-chat-exception.filter';
import { ChatService } from './chat.service';
import type { AuthenticatedUser } from './common/authenticated-user';
import { CurrentUser } from './common/current-user.decorator';

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

@Controller('api')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('v1/chat')
  @UseGuards(CampusChatAuthGuard)
  @UseFilters(CampusChatExceptionFilter)
  createV1Chat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: V1ChatRequest,
  ) {
    return this.chatService.createV1Chat(user, body);
  }

  @Post('chat')
  @UseGuards(BearerAuthGuard)
  createLegacyChat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: LegacyChatRequest,
  ) {
    return this.chatService.generateResponse(user, body);
  }
}
