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
import type { RequestWithUser } from '../auth/request-with-user';
import { ExportsService } from './exports.service';

@ApiTags('exports')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('exports')
export class UserExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @ApiQuery({ name: 'from', required: true, example: '2026-03-01' })
  @ApiQuery({ name: 'to', required: true, example: '2026-03-07' })
  @Get('me.pdf')
  async myPdf(
    @Req() req: RequestWithUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Headers('x-timezone') tz: string | undefined,
    @Res() res: Response,
  ) {
    const { buffer, filename } =
      await this.exportsService.generateMyTimesheetPdf(
        req.user.uid,
        from,
        to,
        tz,
      );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }
}
