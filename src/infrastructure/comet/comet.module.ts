import { Global, Module } from '@nestjs/common';
import { CometService } from './comet.service';

@Global()
@Module({
  providers: [CometService],
  exports: [CometService],
})
export class CometModule {}
