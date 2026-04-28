import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import type { RequestWithUser } from '../auth/request-with-user';
import { WhatsappService } from './whatsapp.service';
import { UpsertWhatsappIntegrationDto } from './dto/upsert-whatsapp-integration.dto';
import { SendTestWhatsappMessageDto } from './dto/send-test-whatsapp-message.dto';

@ApiTags('whatsapp-admin')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, AdminGuard)
@Controller('admin/integrations/whatsapp')
export class WhatsappAdminController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get()
  getIntegration(@Req() req: RequestWithUser) {
    return this.whatsappService.getIntegrationForAdmin(req.user.uid);
  }

  @Post()
  upsertIntegration(
    @Req() req: RequestWithUser,
    @Body() dto: UpsertWhatsappIntegrationDto,
  ) {
    return this.whatsappService.upsertIntegrationForAdmin(req.user.uid, dto);
  }

  @Get('logs')
  getLogs(@Req() req: RequestWithUser, @Query('limit') limit?: string) {
    return this.whatsappService.getLogsForAdmin(req.user.uid, limit);
  }

  @Post('test-message')
  sendTestMessage(
    @Req() req: RequestWithUser,
    @Body() dto: SendTestWhatsappMessageDto,
  ) {
    return this.whatsappService.sendTestMessage(req.user.uid, dto);
  }
}
