import { Body, Controller, Post } from '@nestjs/common';
import { GuidanceService } from './guidance.service';

class GuidanceRequestDto {
  topic?: string;
  grade?: string;
  department?: string;
}

@Controller('api/guidance')
export class GuidanceController {
  constructor(private readonly guidanceService: GuidanceService) {}

  @Post()
  async getGuidance(@Body() dto: GuidanceRequestDto) {
    return this.guidanceService.getGuidance(dto);
  }
}
