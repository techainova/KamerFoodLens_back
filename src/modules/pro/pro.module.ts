import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { MessagesModule } from '../messages/messages.module';
import { ProController } from './pro.controller';
import { ProService } from './pro.service';
import { ProResolver } from './pro.resolver';

@Module({
  imports: [OrdersModule, MessagesModule],
  controllers: [ProController],
  providers: [ProService, ProResolver],
  exports: [ProService],
})
export class ProModule {}
