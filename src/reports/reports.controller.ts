import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import type { RequestWithUser } from '../auth/request-with-user';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiQuery({ name: 'from', required: true, example: '2026-03-01' })
  @ApiQuery({ name: 'to', required: true, example: '2026-03-07' })
  @Get('weekly')
  weekly(
    @Req() req: RequestWithUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportsService.weekly(req.user.uid, from, to);
  }

  @ApiQuery({ name: 'year', required: true, example: 2026 })
  @ApiQuery({ name: 'month', required: true, example: 3, description: '1-12' })
  @Get('monthly')
  monthly(
    @Req() req: RequestWithUser,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.reportsService.monthly(req.user.uid, year, month);
  }
}
