import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import type { RequestWithUser } from '../auth/request-with-user';
import { ScheduleService } from './schedule.service';
import {
  ApplyScheduleTemplateDto,
  BulkUpsertScheduleEntriesDto,
  CopyScheduleMonthDto,
  MarkMySickLeaveDto,
  UpsertScheduleEntryDto,
  UpsertScheduleTemplateDto,
} from './dto/upsert-schedule-entry.dto';

@ApiTags('schedule')
@ApiBearerAuth()
@Controller()
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @ApiQuery({ name: 'month', required: false, example: '2026-03' })
  @UseGuards(FirebaseAuthGuard)
  @Get('schedule/me')
  listMine(@Req() req: RequestWithUser, @Query('month') month?: string) {
    return this.scheduleService.listMine(req.user.uid, month);
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('schedule/me/sick-leave')
  markMySickLeave(
    @Req() req: RequestWithUser,
    @Body() dto: MarkMySickLeaveDto,
  ) {
    return this.scheduleService.markMySickLeave(req.user.uid, dto);
  }

  @ApiQuery({ name: 'month', required: false, example: '2026-03' })
  @ApiQuery({ name: 'userId', required: true })
  @UseGuards(FirebaseAuthGuard, AdminGuard)
  @Get('admin/schedule')
  listAdmin(
    @Req() req: RequestWithUser,
    @Query('userId') userId: string,
    @Query('month') month?: string,
  ) {
    return this.scheduleService.listForAdmin(req.user.uid, userId, month);
  }

  @UseGuards(FirebaseAuthGuard, AdminGuard)
  @Post('admin/schedule')
  upsertAdmin(
    @Req() req: RequestWithUser,
    @Body() dto: UpsertScheduleEntryDto,
  ) {
    return this.scheduleService.upsertForAdmin(req.user.uid, dto);
  }

  @UseGuards(FirebaseAuthGuard, AdminGuard)
  @Post('admin/schedule/bulk')
  bulkUpsertAdmin(
    @Req() req: RequestWithUser,
    @Body() dto: BulkUpsertScheduleEntriesDto,
  ) {
    return this.scheduleService.bulkUpsertForAdmin(req.user.uid, dto);
  }

  @ApiQuery({ name: 'userId', required: true })
  @UseGuards(FirebaseAuthGuard, AdminGuard)
  @Get('admin/schedule/template')
  listTemplateAdmin(
    @Req() req: RequestWithUser,
    @Query('userId') userId: string,
  ) {
    return this.scheduleService.listTemplateForAdmin(req.user.uid, userId);
  }

  @UseGuards(FirebaseAuthGuard, AdminGuard)
  @Post('admin/schedule/template')
  saveTemplateAdmin(
    @Req() req: RequestWithUser,
    @Body() dto: UpsertScheduleTemplateDto,
  ) {
    return this.scheduleService.saveTemplateForAdmin(req.user.uid, dto);
  }

  @UseGuards(FirebaseAuthGuard, AdminGuard)
  @Post('admin/schedule/template/apply')
  applyTemplateAdmin(
    @Req() req: RequestWithUser,
    @Body() dto: ApplyScheduleTemplateDto,
  ) {
    return this.scheduleService.applyTemplateForAdmin(req.user.uid, dto);
  }

  @UseGuards(FirebaseAuthGuard, AdminGuard)
  @Post('admin/schedule/copy-month')
  copyMonthAdmin(
    @Req() req: RequestWithUser,
    @Body() dto: CopyScheduleMonthDto,
  ) {
    return this.scheduleService.copyMonthForAdmin(req.user.uid, dto);
  }

  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'date', required: true, example: '2026-03-25' })
  @UseGuards(FirebaseAuthGuard, AdminGuard)
  @Delete('admin/schedule')
  deleteAdmin(
    @Req() req: RequestWithUser,
    @Query('userId') userId: string,
    @Query('date') date: string,
  ) {
    return this.scheduleService.deleteForAdmin(req.user.uid, userId, date);
  }
}
