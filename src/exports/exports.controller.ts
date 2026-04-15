import {
  Controller,
  Get,
  Headers,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import type { RequestWithUser } from '../auth/request-with-user';
import { ExportsService } from './exports.service';

@ApiTags('exports')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, AdminGuard)
@Controller('admin/exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @ApiQuery({ name: 'from', required: true, example: '2026-03-01' })
  @ApiQuery({ name: 'to', required: true, example: '2026-03-07' })
  @Get('company.xlsx')
  async exportCompanyXlsx(
    @Req() req: RequestWithUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.exportsService.companyXlsx(
      req.user.uid,
      from,
      to,
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.send(buffer);
  }

  @ApiQuery({ name: 'userId', required: true, example: 'uuid-del-empleado' })
  @ApiQuery({ name: 'from', required: true, example: '2026-03-01' })
  @ApiQuery({ name: 'to', required: true, example: '2026-03-07' })
  @Get('user.pdf')
  async exportUserPdf(
    @Req() req: RequestWithUser,
    @Query('userId') userId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Headers('x-timezone') tz: string | undefined,
    @Res() res: Response,
  ) {
    const { buffer, filename } =
      await this.exportsService.generateAdminUserTimesheetPdf(
        req.user.uid,
        userId,
        from,
        to,
        tz,
      );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }
}
