import { Module } from '@nestjs/common';
import { CaptchaService } from './captcha.service';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  controllers: [OnboardingController],
  providers: [OnboardingService, CaptchaService],
  exports: [CaptchaService],
})
export class OnboardingModule {}
