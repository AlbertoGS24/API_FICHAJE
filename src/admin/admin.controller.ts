import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import type { RequestWithUser } from '../auth/request-with-user';
import { AdminService } from './admin.service';

import { AssignRequestDto } from './dto/assign-request.dto';
import { ReviewRequestDto } from './dto/review-request.dto';
import { UpdateUserGroupDto } from './dto/update-user-group.dto';
import { UpdateInternshipHoursDto } from './dto/update-internship-hours.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { SetWorkplaceDto } from './dto/set-workplace.dto';
import { UpsertWorkplaceDto } from './dto/upsert-workplace.dto';
import { UpdateCompanyLocationDto } from './dto/update-company-location.dto';
import { CreateHolidayDto, UpdateHolidayDto } from './dto/upsert-holiday.dto';
import { ImportOfficialHolidaysDto } from './dto/import-official-holidays.dto';
import { SendTestEmailDto } from './dto/send-test-email.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiQuery({ name: 'from', required: true, example: '2026-03-01' })
  @ApiQuery({ name: 'to', required: true, example: '2026-03-07' })
  @Get('reports/weekly')
  weeklyCompany(
    @Req() req: RequestWithUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.adminService.weeklyCompany(req.user.uid, from, to);
  }

  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['VACATION', 'SICK_LEAVE', 'DAY_OFF', 'OVERTIME', 'CORRECTION'],
  })
  @ApiQuery({
    name: 'source',
    required: false,
    enum: ['EMPLOYEE', 'COMPANY'],
  })
  @Get('requests')
  getRequests(
    @Req() req: RequestWithUser,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('source') source?: string,
  ) {
    return this.adminService.getRequests(req.user.uid, status, type, source);
  }

  @Get('requests/:id')
  getRequestById(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.adminService.getRequestById(req.user.uid, id);
  }

  @Get('dashboard')
  dashboard(@Req() req: RequestWithUser) {
    return this.adminService.dashboard(req.user.uid);
  }

  @Get('shifts/today')
  todayShifts(@Req() req: RequestWithUser) {
    return this.adminService.todayShifts(req.user.uid);
  }

  @Get('system/backup-status')
  getBackupStatus(@Req() req: RequestWithUser) {
    return this.adminService.getBackupStatus(req.user.uid);
  }

  @Post('system/backup')
  runBackupNow(@Req() req: RequestWithUser) {
    return this.adminService.runBackupNow(req.user.uid);
  }

  @Post('system/test-email')
  sendTestEmail(@Req() req: RequestWithUser, @Body() dto: SendTestEmailDto) {
    return this.adminService.sendTestEmail(req.user.uid, dto);
  }

  @Get('workplace')
  getWorkplace(@Req() req: RequestWithUser) {
    return this.adminService.getWorkplace(req.user.uid);
  }

  @Get('workplaces')
  listWorkplaces(@Req() req: RequestWithUser) {
    return this.adminService.listWorkplaces(req.user.uid);
  }

  @Post('workplace')
  setWorkplace(@Req() req: RequestWithUser, @Body() dto: SetWorkplaceDto) {
    return this.adminService.setWorkplace(req.user.uid, dto);
  }

  @Post('workplaces')
  upsertWorkplace(
    @Req() req: RequestWithUser,
    @Body() dto: UpsertWorkplaceDto,
  ) {
    return this.adminService.upsertWorkplace(req.user.uid, dto);
  }

  @Delete('workplaces/:id')
  deleteWorkplace(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.adminService.deleteWorkplace(req.user.uid, id);
  }

  @Get('company/location')
  getCompanyLocation(@Req() req: RequestWithUser) {
    return this.adminService.getCompanyLocation(req.user.uid);
  }

  @Post('company/location')
  setCompanyLocation(
    @Req() req: RequestWithUser,
    @Body() dto: UpdateCompanyLocationDto,
  ) {
    return this.adminService.setCompanyLocation(req.user.uid, dto);
  }

  @ApiQuery({ name: 'from', required: false, example: '2026-04-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-04-30' })
  @Get('holidays')
  holidays(
    @Req() req: RequestWithUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminService.listHolidays(req.user.uid, from, to);
  }

  @Post('holidays')
  createHoliday(@Req() req: RequestWithUser, @Body() dto: CreateHolidayDto) {
    return this.adminService.createHoliday(req.user.uid, dto);
  }

  @Post('holidays/import-official')
  importOfficialHolidays(
    @Req() req: RequestWithUser,
    @Body() dto: ImportOfficialHolidaysDto,
  ) {
    return this.adminService.importOfficialHolidays(req.user.uid, dto);
  }

  @Post('holidays/:id')
  updateHoliday(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateHolidayDto,
  ) {
    return this.adminService.updateHoliday(req.user.uid, id, dto);
  }

  @Delete('holidays/:id')
  deleteHoliday(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.adminService.deleteHoliday(req.user.uid, id);
  }

  @ApiQuery({ name: 'from', required: false, example: '2026-03-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-03-07' })
  @ApiQuery({ name: 'limit', required: false, example: '100' })
  @Get('shifts/suspicious')
  suspiciousShifts(
    @Req() req: RequestWithUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.suspiciousShifts(req.user.uid, from, to, limit);
  }

  @ApiQuery({ name: 'targetUserId', required: false })
  @ApiQuery({ name: 'limit', required: false, example: '50' })
  @Get('audit-logs')
  auditLogs(
    @Req() req: RequestWithUser,
    @Query('targetUserId') targetUserId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.auditLogs(req.user.uid, targetUserId, limit);
  }

  @Get('users')
  users(@Req() req: RequestWithUser) {
    return this.adminService.users(req.user.uid);
  }

  @Get('users/export.xlsx')
  async exportUsers(
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } =
      await this.adminService.generateUsersExportXlsx(req.user.uid);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }

  @Get('users/:id/profile')
  getUserProfile(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.adminService.getUserProfile(req.user.uid, id);
  }

  @Post('users')
  createUser(@Req() req: RequestWithUser, @Body() dto: CreateAdminUserDto) {
    return this.adminService.createUser(req.user.uid, dto);
  }

  @Get('users/import-template.xlsx')
  async downloadUsersImportTemplate(
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } =
      await this.adminService.generateUsersImportTemplate(req.user.uid);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }

  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 2 * 1024 * 1024,
      },
    }),
  )
  @Post('users/import')
  importUsers(
    @Req() req: RequestWithUser,
    @UploadedFile() file: { buffer?: Buffer; originalname?: string } | undefined,
  ) {
    return this.adminService.importUsersFromExcel(
      req.user.uid,
      file?.buffer ?? Buffer.alloc(0),
    );
  }

  @Post('users/:id/send-access')
  sendUserAccess(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.adminService.sendUserAccess(req.user.uid, id);
  }

  @Delete('users/:id')
  deleteUser(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.adminService.deleteUser(req.user.uid, id);
  }

  @Post('users/:id/group')
  updateUserGroup(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserGroupDto,
  ) {
    return this.adminService.updateUserGroup(req.user.uid, id, dto);
  }

  @Post('users/:id/role')
  updateUserRole(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(req.user.uid, id, dto);
  }

  @Post('users/:id/settings')
  updateUserSettings(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    return this.adminService.updateUserSettings(req.user.uid, id, dto);
  }

  @Post('users/:id/internship-hours')
  updateInternshipHours(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateInternshipHoursDto,
  ) {
    return this.adminService.updateInternshipHours(req.user.uid, id, dto);
  }

  @Post('requests/:id/approve')
  approveRequest(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: ReviewRequestDto,
  ) {
    return this.adminService.approveRequest(req.user.uid, id, dto);
  }

  @Post('requests/:id/reject')
  rejectRequest(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: ReviewRequestDto,
  ) {
    return this.adminService.rejectRequest(req.user.uid, id, dto);
  }

  @Post('requests/assign-vacation')
  assignVacation(@Req() req: RequestWithUser, @Body() dto: AssignRequestDto) {
    return this.adminService.assignVacation(req.user.uid, dto);
  }

  @Post('requests/assign-sick-leave')
  assignSickLeave(@Req() req: RequestWithUser, @Body() dto: AssignRequestDto) {
    return this.adminService.assignSickLeave(req.user.uid, dto);
  }

  @Post('requests/assign-day-off')
  assignDayOff(@Req() req: RequestWithUser, @Body() dto: AssignRequestDto) {
    return this.adminService.assignDayOff(req.user.uid, dto);
  }

  @Post('requests/assign-overtime')
  assignOvertime(@Req() req: RequestWithUser, @Body() dto: AssignRequestDto) {
    return this.adminService.assignOvertime(req.user.uid, dto);
  }
}
