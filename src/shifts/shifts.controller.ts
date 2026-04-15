import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import type { RequestWithUser } from '../auth/request-with-user';
import { ShiftsService } from './shifts.service';
import { ClockLocationDto } from './dto/clock-location.dto';

@ApiTags('shifts')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get('status')
  async status(@Req() req: RequestWithUser) {
    return this.shiftsService.status(req.user.uid);
  }

  @Get('me')
  async mine(@Req() req: RequestWithUser, @Query('limit') limit?: string) {
    return this.shiftsService.mine(req.user.uid, limit);
  }

  @Post('clock-in')
  async clockIn(@Req() req: RequestWithUser, @Body() dto: ClockLocationDto) {
    return this.shiftsService.clockIn(req.user.uid, dto, {
      ip: req.ip,
      userAgent: req.header('user-agent') ?? null,
    });
  }

  @Post('clock-out')
  async clockOut(@Req() req: RequestWithUser, @Body() dto: ClockLocationDto) {
    return this.shiftsService.clockOut(req.user.uid, dto, {
      ip: req.ip,
      userAgent: req.header('user-agent') ?? null,
    });
  }
}
