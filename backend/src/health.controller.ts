import { Controller, Get } from '@nestjs/common';

@Controller('api/health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'gsm-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
