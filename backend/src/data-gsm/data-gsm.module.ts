import { Global, Module } from '@nestjs/common';
import { DataGsmClient } from './data-gsm.client';

@Global()
@Module({
  providers: [DataGsmClient],
  exports: [DataGsmClient],
})
export class DataGsmModule {}
