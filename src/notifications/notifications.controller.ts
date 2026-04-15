import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import type { RequestWithUser } from '../auth/request-with-user';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('me')
  listMine(@Req() req: RequestWithUser) {
    return this.notificationsService.listMine(req.user.uid);
  }

  @Patch(':id/read')
  markRead(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.notificationsService.markRead(req.user.uid, id);
  }
}
