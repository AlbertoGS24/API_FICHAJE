import { Controller, Get } from '@nestjs/common';
import { getCompanyOnboardingConfig } from './onboarding/company-onboarding.config';
import { getTurnstileConfig } from './onboarding/turnstile.config';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('config/public')
  getPublicConfig() {
    const turnstile = getTurnstileConfig();
    const onboarding = getCompanyOnboardingConfig();
    const turnstileEnabled = turnstile.enabled && Boolean(turnstile.siteKey);

    return {
      firebaseApiKey:
        process.env.FIREBASE_WEB_API_KEY ??
        process.env.FIREBASE_API_KEY ??
        null,
      publicCompanySelfRegisterEnabled: onboarding.publicSelfRegisterEnabled,
      publicDevToolsEnabled: onboarding.publicDevToolsEnabled,
      turnstileEnabled,
      turnstileSiteKey: turnstileEnabled ? turnstile.siteKey : null,
    };
  }
}
