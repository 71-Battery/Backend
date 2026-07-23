import { Global, Module } from '@nestjs/common';
import { CampusAiClient } from './campus-ai.client';

@Global()
@Module({
  providers: [CampusAiClient],
  exports: [CampusAiClient],
})
export class CampusAiModule {}
