import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parsePort(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? '');
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.trunc(parsed);
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly enabled = parseBooleanEnv(process.env.MAIL_ENABLED, false);
  private readonly fromAddress = (process.env.MAIL_FROM ?? '').trim();
  private readonly fromName =
    (process.env.MAIL_FROM_NAME ?? 'Fichaje').trim() || 'Fichaje';
  private readonly host = (process.env.SMTP_HOST ?? '').trim();
  private readonly port = parsePort(process.env.SMTP_PORT, 587);
  private readonly secure = parseBooleanEnv(process.env.SMTP_SECURE, false);
  private readonly user = (process.env.SMTP_USER ?? '').trim();
  private readonly pass = process.env.SMTP_PASS ?? '';
  private warnedDisabled = false;
  private warnedMissingConfig = false;

  private isConfigured() {
    return !!(
      this.enabled &&
      this.fromAddress &&
      this.host &&
      this.port &&
      this.user &&
      this.pass
    );
  }

  private getFromHeader() {
    return this.fromName
      ? `"${this.fromName}" <${this.fromAddress}>`
      : this.fromAddress;
  }

  private getTransporter() {
    return nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: this.secure,
      auth: {
        user: this.user,
        pass: this.pass,
      },
    });
  }

  async sendTextEmail(to: string, subject: string, text: string) {
    const recipient = to.trim();
    if (!recipient)
      return { sent: false, skipped: true, reason: 'no-recipient' };

    if (!this.enabled) {
      if (!this.warnedDisabled) {
        this.logger.log(
          'Notificaciones por email desactivadas (MAIL_ENABLED=false).',
        );
        this.warnedDisabled = true;
      }
      return { sent: false, skipped: true, reason: 'disabled' };
    }

    if (!this.isConfigured()) {
      if (!this.warnedMissingConfig) {
        this.logger.warn(
          'Configuración SMTP incompleta. Revisa MAIL_FROM, SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS.',
        );
        this.warnedMissingConfig = true;
      }
      return { sent: false, skipped: true, reason: 'missing-config' };
    }

    const transporter = this.getTransporter();
    const info = await transporter.sendMail({
      from: this.getFromHeader(),
      to: recipient,
      subject,
      text,
    });

    return {
      sent: true,
      skipped: false,
      messageId: info.messageId,
    };
  }
}
