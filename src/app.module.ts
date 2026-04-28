import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { ShiftsModule } from './shifts/shifts.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';
import { RequestsModule } from './requests/requests.module';
import { ExportsModule } from './exports/exports.module';
import { DocumentsModule } from './documents/documents.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { ScheduleModule } from './schedule/schedule.module';
import { AgentModule } from './agent/agent.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    HealthModule,
    UsersModule,
    ShiftsModule,
    PrismaModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ReportsModule,
    AdminModule,
    RequestsModule,
    ExportsModule,
    DocumentsModule,
    NotificationsModule,
    OnboardingModule,
    ScheduleModule,
    AgentModule,
    WhatsappModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
