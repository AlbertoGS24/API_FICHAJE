import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { WhatsappAdminController } from './whatsapp.admin.controller';
import { WhatsappWebhookController } from './whatsapp.webhook.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [PrismaModule, UsersModule, ShiftsModule],
  controllers: [WhatsappAdminController, WhatsappWebhookController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
