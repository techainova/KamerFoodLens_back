import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminResolver } from './admin.resolver';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [BullModule.registerQueue({ name: 'payout' }), NotificationsModule],
  controllers: [AdminController],
  providers: [AdminService, AdminResolver],
  exports: [AdminService],
})
export class AdminModule {}
