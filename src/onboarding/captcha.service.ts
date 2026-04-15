import { BadRequestException, Injectable } from '@nestjs/common';
import { getTurnstileConfig } from './turnstile.config';

type TurnstileVerifyResponse = {
  success?: boolean;
  ['error-codes']?: string[];
};

@Injectable()
export class CaptchaService {
  private readonly config = getTurnstileConfig();

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getSiteKey(): string | null {
    return this.config.siteKey;
  }

  async verifyOrThrow(token: string | undefined, remoteIp?: string) {
    if (!this.config.enabled) return;

    const normalizedToken = token?.trim() ?? '';
    if (!normalizedToken) {
      throw new BadRequestException(
        'CAPTCHA obligatorio. Completa la verificación.',
      );
    }

    if (!this.config.secretKey) {
      throw new BadRequestException(
        'CAPTCHA no configurado en el servidor. Falta TURNSTILE_SECRET_KEY.',
      );
    }

    const form = new URLSearchParams();
    form.set('secret', this.config.secretKey);
    form.set('response', normalizedToken);
    if (remoteIp) form.set('remoteip', remoteIp);

    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      },
    );

    const payload =
      ((await response
        .json()
        .catch(() => null)) as TurnstileVerifyResponse | null) ?? null;

    if (response.ok && payload?.success) return;

    const errorCodes = Array.isArray(payload?.['error-codes'])
      ? payload['error-codes'].join(', ')
      : '';
    const suffix = errorCodes ? ` (${errorCodes})` : '';
    throw new BadRequestException(`CAPTCHA inválido${suffix}`);
  }
}
