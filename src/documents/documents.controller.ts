import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import type { RequestWithUser } from '../auth/request-with-user';
import { DocumentsService } from './documents.service';
import { CreateTimesheetDocumentDto } from './dto/create-timesheet-document.dto';
import { SignDocumentDto } from './dto/sign-document.dto';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('timesheet')
  createTimesheet(
    @Req() req: RequestWithUser,
    @Body() dto: CreateTimesheetDocumentDto,
  ) {
    return this.documentsService.createTimesheet(req.user.uid, dto);
  }

  @Get('me')
  listMine(@Req() req: RequestWithUser) {
    return this.documentsService.listMine(req.user.uid);
  }

  @Get(':id')
  getMineById(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.documentsService.getMineById(req.user.uid, id);
  }

  @Post(':id/sign')
  sign(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: SignDocumentDto,
  ) {
    return this.documentsService.sign(req.user.uid, id, dto);
  }

  @Get(':id/download')
  async downloadMine(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename, sha256 } =
      await this.documentsService.downloadMine(req.user.uid, id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Document-Sha256', sha256 ?? '');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }
}
