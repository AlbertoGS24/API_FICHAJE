import { Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { WhatsappService } from './whatsapp.service';

@Controller('webhooks/whatsapp')
export class WhatsappWebhookController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get()
  verifyWebhook(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') verifyToken?: string,
    @Query('hub.challenge') challenge?: string,
    @Res() res?: Response,
  ) {
    const value = this.whatsappService.verifyWebhook(mode, verifyToken, challenge);
    return res?.status(200).send(value);
  }

  @Post()
  async receiveWebhook(@Body() payload: unknown, @Req() req: Request) {
    await this.whatsappService.handleWebhook(payload, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? null,
    });
    return { received: true };
  }
}
