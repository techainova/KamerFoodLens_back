import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { PushProcessor } from './push.processor';
import { PayoutProcessor } from './payout.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'push' }, { name: 'payout' })],
  providers: [PushProcessor, PayoutProcessor],
  exports: [BullModule],
})
export class JobsModule {}
