import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import type { RequestWithUser } from '../auth/request-with-user';
import { CreateRequestDto } from './dto/create-request.dto';
import { RequestsService } from './requests.service';

@ApiTags('requests')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreateRequestDto) {
    return this.requestsService.create(req.user.uid, dto);
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
  @Get('me')
  getMine(
    @Req() req: RequestWithUser,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('source') source?: string,
  ) {
    return this.requestsService.getMine(req.user.uid, status, type, source);
  }

  @Get(':id')
  getMineById(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.requestsService.getMineById(req.user.uid, id);
  }

  @Post(':id/cancel')
  cancelMine(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.requestsService.cancelMine(req.user.uid, id);
  }
}
