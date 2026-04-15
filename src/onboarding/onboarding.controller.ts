import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminGuard } from '../auth/admin.guard';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import type { RequestWithUser } from '../auth/request-with-user';
import { ActivateAdminWithKeyDto } from './dto/activate-admin-with-key.dto';
import { CreateAdminActivationKeyDto } from './dto/create-admin-activation-key.dto';
import { SelfRegisterCompanyDto } from './dto/self-register-company.dto';
import { OnboardingService } from './onboarding.service';

@ApiTags('onboarding')
@Controller()
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  private getClientIp(req: Request): string | undefined {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0].split(',')[0].trim();
    }
    const ip = req.ip || req.socket?.remoteAddress;
    if (!ip) return undefined;
    return ip.trim() || undefined;
  }

  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard, AdminGuard)
  @Post('admin/onboarding/activation-keys')
  createActivationKey(
    @Req() req: RequestWithUser,
    @Body() dto: CreateAdminActivationKeyDto,
  ) {
    return this.onboardingService.createActivationKey(req.user.uid, dto);
  }

  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard, AdminGuard)
  @ApiQuery({ name: 'limit', required: false, example: '50' })
  @Get('admin/onboarding/activation-keys')
  listActivationKeys(
    @Req() req: RequestWithUser,
    @Query('limit') limit?: string,
  ) {
    return this.onboardingService.listActivationKeys(req.user.uid, limit);
  }

  @Post('onboarding/activate-admin')
  activateAdminWithKey(
    @Req() req: Request,
    @Body() dto: ActivateAdminWithKeyDto,
  ) {
    return this.onboardingService.activateAdminWithKey(
      dto,
      this.getClientIp(req),
    );
  }

  @Post('onboarding/self-register-company')
  selfRegisterCompany(
    @Req() req: Request,
    @Body() dto: SelfRegisterCompanyDto,
  ) {
    return this.onboardingService.selfRegisterCompany(
      dto,
      this.getClientIp(req),
    );
  }
}
