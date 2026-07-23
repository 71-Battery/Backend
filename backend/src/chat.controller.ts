import { Body, Controller, Post } from '@nestjs/common';
import { ChatService } from './chat.service';

class ChatRequestDto {
  message?: string;
  grade?: string;
  department?: string;
}

@Controller('api/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async createChat(@Body() dto: ChatRequestDto) {
    return this.chatService.generateResponse(dto);
  }
}
