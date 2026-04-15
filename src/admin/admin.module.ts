import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ScheduleModule } from '../schedule/schedule.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [ScheduleModule, MailModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
