import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Prisma,
  WhatsappClockAction,
  WhatsappClockSessionStatus,
  WhatsappMessageDirection,
  WhatsappMessageStatus,
  WhatsappProvider,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { ShiftsService } from '../shifts/shifts.service';
import { normalizeInternationalPhone } from '../shared/phone';
import { UpsertWhatsappIntegrationDto } from './dto/upsert-whatsapp-integration.dto';
import { SendTestWhatsappMessageDto } from './dto/send-test-whatsapp-message.dto';

const DEFAULT_GRAPH_API_VERSION =
  process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || 'v22.0';
const DEFAULT_GRAPH_API_BASE_URL =
  process.env.WHATSAPP_GRAPH_API_BASE_URL?.trim() ||
  'https://graph.facebook.com';
const DEFAULT_CLOCK_TTL_MINUTES = (() => {
  const parsed = Number(process.env.WHATSAPP_CLOCK_SESSION_TTL_MINUTES ?? '3');
  if (!Number.isFinite(parsed) || parsed <= 0) return 3;
  return Math.min(Math.max(Math.trunc(parsed), 1), 30);
})();

function parseBooleanEnv(name: string, fallback: boolean) {
  const raw = process.env[name]?.trim().toLowerCase() ?? '';
  if (!raw) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  return fallback;
}

function safeTrim(value: string | null | undefined, maxLength = 2000) {
  const normalized = (value ?? '').trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function normalizeWhatsappSender(raw: string | null | undefined) {
  const digits = (raw ?? '').replace(/\D+/g, '');
  if (!digits) return null;
  try {
    return normalizeInternationalPhone(`+${digits}`);
  } catch {
    return `+${digits}`;
  }
}

function normalizeCommandText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatMadridDateTime(value: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function minutesBetween(startAt: Date, endAt: Date | null) {
  if (!endAt) return 0;
  const diffMs = endAt.getTime() - startAt.getTime();
  return diffMs > 0 ? Math.ceil(diffMs / 60000) : 0;
}

type WebhookContext = {
  ip?: string | null;
  userAgent?: string | null;
};

type MetaLocationMessage = {
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
};

type MetaTextMessage = {
  body?: string;
};

type MetaIncomingMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: MetaTextMessage;
  location?: MetaLocationMessage;
};

type IncomingMessageEvent = {
  metadataPhoneNumberId: string | null;
  metadataDisplayPhoneNumber: string | null;
  message: MetaIncomingMessage;
  rawPayload: unknown;
};

type AdminIdentity = {
  id: string;
  companyId: string;
  name: string | null;
  email: string | null;
};

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly enabled = parseBooleanEnv('WHATSAPP_ENABLED', false);
  private readonly graphApiVersion = DEFAULT_GRAPH_API_VERSION;
  private readonly graphApiBaseUrl = DEFAULT_GRAPH_API_BASE_URL;
  private readonly clockSessionTtlMinutes = DEFAULT_CLOCK_TTL_MINUTES;

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly shiftsService: ShiftsService,
  ) {}

  private getVerifyToken() {
    return safeTrim(process.env.WHATSAPP_VERIFY_TOKEN, 200);
  }

  private getAccessToken() {
    return safeTrim(process.env.WHATSAPP_ACCESS_TOKEN, 5000);
  }

  private hasProviderConfig() {
    return !!this.getAccessToken();
  }

  private async getAdmin(firebaseUidAdmin: string): Promise<AdminIdentity> {
    const admin = await this.prisma.user.findUnique({
      where: { firebaseUid: firebaseUidAdmin },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        company: {
          select: {
            isActive: true,
          },
        },
      },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new NotFoundException('Administrador no encontrado');
    }
    if (!admin.company.isActive) {
      throw new BadRequestException('La empresa está desactivada');
    }

    return {
      id: admin.id,
      companyId: admin.companyId,
      name: admin.name,
      email: admin.email,
    };
  }

  private serializeIntegration(
    integration:
      | {
          id: string;
          companyId: string;
          provider: WhatsappProvider;
          isEnabled: boolean;
          displayPhoneNumber: string | null;
          phoneNumberId: string | null;
          businessAccountId: string | null;
          allowClockIn: boolean;
          allowClockOut: boolean;
          requireLocation: boolean;
          lastInboundAt: Date | null;
          lastOutboundAt: Date | null;
          createdAt: Date;
          updatedAt: Date;
        }
      | null,
    companyId: string,
  ) {
    return {
      id: integration?.id ?? null,
      companyId,
      provider: 'META_CLOUD_API',
      isEnabled: integration?.isEnabled ?? false,
      displayPhoneNumber: integration?.displayPhoneNumber ?? null,
      phoneNumberId: integration?.phoneNumberId ?? null,
      businessAccountId: integration?.businessAccountId ?? null,
      allowClockIn: integration?.allowClockIn ?? true,
      allowClockOut: integration?.allowClockOut ?? true,
      requireLocation: integration?.requireLocation ?? true,
      lastInboundAt: integration?.lastInboundAt ?? null,
      lastOutboundAt: integration?.lastOutboundAt ?? null,
      providerReady: this.enabled && this.hasProviderConfig(),
      webhookReady: !!this.getVerifyToken(),
      createdAt: integration?.createdAt ?? null,
      updatedAt: integration?.updatedAt ?? null,
    };
  }

  async getIntegrationForAdmin(firebaseUidAdmin: string) {
    const admin = await this.getAdmin(firebaseUidAdmin);
    const integration = await this.prisma.whatsappIntegration.findUnique({
      where: {
        companyId_provider: {
          companyId: admin.companyId,
          provider: WhatsappProvider.META_CLOUD_API,
        },
      },
    });

    return this.serializeIntegration(integration, admin.companyId);
  }

  async upsertIntegrationForAdmin(
    firebaseUidAdmin: string,
    dto: UpsertWhatsappIntegrationDto,
  ) {
    const admin = await this.getAdmin(firebaseUidAdmin);
    const current = await this.prisma.whatsappIntegration.findUnique({
      where: {
        companyId_provider: {
          companyId: admin.companyId,
          provider: WhatsappProvider.META_CLOUD_API,
        },
      },
    });

    const nextPhoneNumberId = safeTrim(dto.phoneNumberId, 100);
    const nextDisplayPhone = safeTrim(dto.displayPhoneNumber, 60);
    const nextBusinessId = safeTrim(dto.businessAccountId, 100);
    const nextIsEnabled = dto.isEnabled ?? current?.isEnabled ?? false;

    if (nextIsEnabled && !(nextPhoneNumberId ?? current?.phoneNumberId)) {
      throw new BadRequestException(
        'Para activar WhatsApp debes indicar el Phone Number ID de Meta',
      );
    }

    const integration = await this.prisma.whatsappIntegration.upsert({
      where: {
        companyId_provider: {
          companyId: admin.companyId,
          provider: WhatsappProvider.META_CLOUD_API,
        },
      },
      create: {
        companyId: admin.companyId,
        provider: WhatsappProvider.META_CLOUD_API,
        isEnabled: nextIsEnabled,
        displayPhoneNumber: nextDisplayPhone,
        phoneNumberId: nextPhoneNumberId,
        businessAccountId: nextBusinessId,
        allowClockIn: dto.allowClockIn ?? true,
        allowClockOut: dto.allowClockOut ?? true,
        requireLocation: dto.requireLocation ?? true,
      },
      update: {
        isEnabled: nextIsEnabled,
        displayPhoneNumber:
          dto.displayPhoneNumber !== undefined
            ? nextDisplayPhone
            : undefined,
        phoneNumberId:
          dto.phoneNumberId !== undefined ? nextPhoneNumberId : undefined,
        businessAccountId:
          dto.businessAccountId !== undefined ? nextBusinessId : undefined,
        allowClockIn:
          dto.allowClockIn !== undefined ? dto.allowClockIn : undefined,
        allowClockOut:
          dto.allowClockOut !== undefined ? dto.allowClockOut : undefined,
        requireLocation:
          dto.requireLocation !== undefined ? dto.requireLocation : undefined,
      },
    });

    return this.serializeIntegration(integration, admin.companyId);
  }

  async getLogsForAdmin(firebaseUidAdmin: string, limitRaw?: string) {
    const admin = await this.getAdmin(firebaseUidAdmin);
    const parsed = Number(limitRaw ?? '30');
    const limit = Number.isFinite(parsed)
      ? Math.min(Math.max(Math.trunc(parsed), 1), 100)
      : 30;

    const logs = await this.prisma.whatsappMessageLog.findMany({
      where: { companyId: admin.companyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        direction: true,
        status: true,
        messageType: true,
        command: true,
        body: true,
        fromPhone: true,
        toPhone: true,
        errorMessage: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    return logs;
  }

  async sendTestMessage(
    firebaseUidAdmin: string,
    dto: SendTestWhatsappMessageDto,
  ) {
    const admin = await this.getAdmin(firebaseUidAdmin);
    const integration = await this.requireActiveIntegrationByCompanyId(
      admin.companyId,
    );
    const toPhone = normalizeInternationalPhone(dto.toPhone);
    if (!toPhone) {
      throw new BadRequestException('Debes indicar un teléfono válido');
    }

    const result = await this.sendTextMessage({
      integration,
      toPhone,
      body: dto.message.trim(),
      command: 'test_message',
    });

    return {
      sent: true,
      providerMessageId: result.providerMessageId,
      toPhone,
    };
  }

  verifyWebhook(mode?: string, verifyToken?: string, challenge?: string) {
    const expectedToken = this.getVerifyToken();
    if (!expectedToken) {
      throw new ServiceUnavailableException(
        'Falta WHATSAPP_VERIFY_TOKEN en el backend',
      );
    }
    if (mode !== 'subscribe' || verifyToken !== expectedToken) {
      throw new UnauthorizedException('Verificación de WhatsApp inválida');
    }
    return challenge ?? '';
  }

  async handleWebhook(payload: unknown, context?: WebhookContext) {
    await this.expirePendingSessions();
    const events = this.extractIncomingMessageEvents(payload);

    for (const event of events) {
      try {
        await this.processIncomingMessage(event, context);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        this.logger.error(`Error procesando webhook de WhatsApp: ${message}`);
      }
    }

    return {
      received: true,
      messages: events.length,
    };
  }

  async sendReviewedRequestNotification(params: {
    companyId: string;
    userId: string;
    action: 'APPROVED' | 'REJECTED';
    typeLabel: string;
    periodLabel: string;
    adminName: string;
    employeeComment?: string | null;
    reviewComment?: string | null;
  }) {
    const integration = await this.findActiveIntegrationByCompanyId(
      params.companyId,
    );
    if (!integration) {
      return { sent: false, reason: 'integration_disabled' };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });

    if (!user?.phone) {
      return { sent: false, reason: 'missing_phone' };
    }

    const actionLabel = params.action === 'APPROVED' ? 'aprobada' : 'rechazada';
    const employeeName = safeTrim(user.name, 120) || 'usuario';
    const lines = [
      `Hola ${employeeName},`,
      '',
      `Tu solicitud de ${params.typeLabel} ha sido ${actionLabel}.`,
      `Periodo: ${params.periodLabel}`,
      `Revisado por: ${params.adminName}`,
    ];

    const employeeComment = safeTrim(params.employeeComment, 400);
    if (employeeComment) {
      lines.push(`Comentario original: ${employeeComment}`);
    }

    const reviewComment = safeTrim(params.reviewComment, 400);
    if (reviewComment) {
      lines.push(`Comentario del administrador: ${reviewComment}`);
    }

    lines.push('', 'Puedes revisar el detalle completo en la plataforma.');

    await this.sendTextMessage({
      integration,
      toPhone: user.phone,
      body: lines.join('\n'),
      userId: user.id,
      command: `request_${params.action.toLowerCase()}`,
    });

    return { sent: true };
  }

  private async processIncomingMessage(
    event: IncomingMessageEvent,
    context?: WebhookContext,
  ) {
    const integration = event.metadataPhoneNumberId
      ? await this.prisma.whatsappIntegration.findFirst({
          where: {
            phoneNumberId: event.metadataPhoneNumberId,
          },
        })
      : null;

    const fromPhone = normalizeWhatsappSender(event.message.from);
    const inboundLog = await this.prisma.whatsappMessageLog.create({
      data: {
        integrationId: integration?.id ?? null,
        companyId: integration?.companyId ?? null,
        direction: WhatsappMessageDirection.INBOUND,
        status: WhatsappMessageStatus.RECEIVED,
        messageType: safeTrim(event.message.type, 40),
        body:
          event.message.type === 'text'
            ? safeTrim(event.message.text?.body, 2000)
            : null,
        fromPhone,
        toPhone: integration?.displayPhoneNumber ?? event.metadataDisplayPhoneNumber,
        providerMessageId: safeTrim(event.message.id, 120),
        payload: event.rawPayload as Prisma.InputJsonValue,
      },
    });

    if (!integration || !integration.isEnabled) {
      await this.finishInboundLog(inboundLog.id, WhatsappMessageStatus.IGNORED, {
        errorMessage: 'Integración no encontrada o desactivada',
      });
      return;
    }

    await this.prisma.whatsappIntegration.update({
      where: { id: integration.id },
      data: { lastInboundAt: new Date() },
    });

    const user = fromPhone
      ? await this.usersService.findByCompanyAndPhone(integration.companyId, fromPhone)
      : null;

    if (!user) {
      await this.finishInboundLog(inboundLog.id, WhatsappMessageStatus.IGNORED, {
        errorMessage: 'Teléfono no asociado a ningún usuario de la empresa',
      });
      await this.sendTextMessage({
        integration,
        toPhone: fromPhone,
        body:
          'No se ha podido identificar tu usuario con este teléfono. Revisa en la plataforma que esté guardado en formato internacional.',
        command: 'unknown_user',
      }).catch((error) => {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        this.logger.warn(`No se pudo responder a teléfono desconocido: ${message}`);
      });
      return;
    }

    await this.prisma.whatsappMessageLog.update({
      where: { id: inboundLog.id },
      data: {
        userId: user.id,
      },
    });

    if (event.message.type === 'location') {
      await this.handleLocationMessage({
        integration,
        user,
        fromPhone,
        inboundLogId: inboundLog.id,
        location: event.message.location ?? {},
        providerMessageId: safeTrim(event.message.id, 120),
        context,
      });
      return;
    }

    if (event.message.type !== 'text') {
      await this.finishInboundLog(inboundLog.id, WhatsappMessageStatus.IGNORED, {
        errorMessage: 'Tipo de mensaje no soportado',
      });
      await this.sendTextMessage({
        integration,
        toPhone: fromPhone,
        userId: user.id,
        body:
          'Ahora mismo solo puedo procesar texto y ubicación. Escribe AYUDA para ver los comandos disponibles.',
        command: 'unsupported_message',
      });
      return;
    }

    await this.handleTextMessage({
      integration,
      user,
      fromPhone,
      inboundLogId: inboundLog.id,
      text: event.message.text?.body ?? '',
      providerMessageId: safeTrim(event.message.id, 120),
      context,
    });
  }

  private async handleTextMessage(params: {
    integration: {
      id: string;
      companyId: string;
      phoneNumberId: string | null;
      allowClockIn: boolean;
      allowClockOut: boolean;
      requireLocation: boolean;
      displayPhoneNumber: string | null;
    };
    user: {
      id: string;
      companyId: string;
      name: string | null;
      phone: string | null;
      role: string;
      workerGroup: string;
    };
    fromPhone: string | null;
    inboundLogId: string;
    text: string;
    providerMessageId: string | null;
    context?: WebhookContext;
  }) {
    const normalized = normalizeCommandText(params.text);
    const command = this.resolveCommand(normalized);

    await this.prisma.whatsappMessageLog.update({
      where: { id: params.inboundLogId },
      data: { command },
    });

    switch (command) {
      case 'clock_in':
        if (!params.integration.allowClockIn) {
          await this.finishInboundLog(
            params.inboundLogId,
            WhatsappMessageStatus.IGNORED,
            {
              errorMessage: 'Clock-in por WhatsApp desactivado',
            },
          );
          await this.sendTextMessage({
            integration: params.integration,
            toPhone: params.fromPhone,
            userId: params.user.id,
            body: 'El fichaje de entrada por WhatsApp está desactivado para esta empresa.',
            command,
          });
          return;
        }
        await this.beginClockFlow({
          integration: params.integration,
          user: params.user,
          phone: params.fromPhone,
          action: WhatsappClockAction.CLOCK_IN,
          command,
          inboundLogId: params.inboundLogId,
          providerMessageId: params.providerMessageId,
          context: params.context,
        });
        return;
      case 'clock_out':
        if (!params.integration.allowClockOut) {
          await this.finishInboundLog(
            params.inboundLogId,
            WhatsappMessageStatus.IGNORED,
            {
              errorMessage: 'Clock-out por WhatsApp desactivado',
            },
          );
          await this.sendTextMessage({
            integration: params.integration,
            toPhone: params.fromPhone,
            userId: params.user.id,
            body: 'El fichaje de salida por WhatsApp está desactivado para esta empresa.',
            command,
          });
          return;
        }
        await this.beginClockFlow({
          integration: params.integration,
          user: params.user,
          phone: params.fromPhone,
          action: WhatsappClockAction.CLOCK_OUT,
          command,
          inboundLogId: params.inboundLogId,
          providerMessageId: params.providerMessageId,
          context: params.context,
        });
        return;
      case 'status':
        await this.finishInboundLog(params.inboundLogId, WhatsappMessageStatus.PROCESSED);
        await this.sendTextMessage({
          integration: params.integration,
          toPhone: params.fromPhone,
          userId: params.user.id,
          body: await this.buildStatusMessage(params.user.id),
          command,
        });
        return;
      case 'my_hours':
        await this.finishInboundLog(params.inboundLogId, WhatsappMessageStatus.PROCESSED);
        await this.sendTextMessage({
          integration: params.integration,
          toPhone: params.fromPhone,
          userId: params.user.id,
          body: await this.buildHoursMessage(params.user.id),
          command,
        });
        return;
      case 'my_requests':
        await this.finishInboundLog(params.inboundLogId, WhatsappMessageStatus.PROCESSED);
        await this.sendTextMessage({
          integration: params.integration,
          toPhone: params.fromPhone,
          userId: params.user.id,
          body: await this.buildRequestsMessage(params.user.id),
          command,
        });
        return;
      case 'cancel':
        await this.cancelPendingSessionsForUser(
          params.integration.companyId,
          params.user.id,
        );
        await this.finishInboundLog(params.inboundLogId, WhatsappMessageStatus.PROCESSED);
        await this.sendTextMessage({
          integration: params.integration,
          toPhone: params.fromPhone,
          userId: params.user.id,
          body: 'He cancelado cualquier fichaje pendiente de ubicación.',
          command,
        });
        return;
      case 'help':
      default:
        await this.finishInboundLog(params.inboundLogId, WhatsappMessageStatus.PROCESSED);
        await this.sendTextMessage({
          integration: params.integration,
          toPhone: params.fromPhone,
          userId: params.user.id,
          body: this.buildHelpMessage(),
          command: command || 'help',
        });
        return;
    }
  }

  private async handleLocationMessage(params: {
    integration: {
      id: string;
      companyId: string;
      phoneNumberId: string | null;
      displayPhoneNumber: string | null;
    };
    user: {
      id: string;
      companyId: string;
      name: string | null;
      phone: string | null;
    };
    fromPhone: string | null;
    inboundLogId: string;
    location: MetaLocationMessage;
    providerMessageId: string | null;
    context?: WebhookContext;
  }) {
    const session = await this.prisma.whatsappClockSession.findFirst({
      where: {
        companyId: params.integration.companyId,
        userId: params.user.id,
        status: WhatsappClockSessionStatus.PENDING_LOCATION,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      await this.finishInboundLog(params.inboundLogId, WhatsappMessageStatus.IGNORED, {
        errorMessage: 'Ubicación recibida sin sesión pendiente',
      });
      await this.sendTextMessage({
        integration: params.integration,
        toPhone: params.fromPhone,
        userId: params.user.id,
        body:
          'He recibido tu ubicación, pero no había un fichaje pendiente. Escribe FICHAR ENTRADA o FICHAR SALIDA primero.',
        command: 'location_without_session',
      });
      return;
    }

    if (session.expiresAt.getTime() < Date.now()) {
      await this.prisma.whatsappClockSession.update({
        where: { id: session.id },
        data: {
          status: WhatsappClockSessionStatus.EXPIRED,
        },
      });
      await this.finishInboundLog(params.inboundLogId, WhatsappMessageStatus.IGNORED, {
        errorMessage: 'Sesión de fichaje expirada',
      });
      await this.sendTextMessage({
        integration: params.integration,
        toPhone: params.fromPhone,
        userId: params.user.id,
        body:
          'La petición de fichaje había caducado. Vuelve a escribir FICHAR ENTRADA o FICHAR SALIDA.',
        command: 'expired_clock_session',
      });
      return;
    }

    const lat = params.location.latitude;
    const lng = params.location.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      await this.finishInboundLog(params.inboundLogId, WhatsappMessageStatus.FAILED, {
        errorMessage: 'Ubicación sin latitud o longitud válidas',
      });
      await this.sendTextMessage({
        integration: params.integration,
        toPhone: params.fromPhone,
        userId: params.user.id,
        body:
          'No se pudo leer la ubicación enviada. Comparte tu ubicación actual desde el adjunto de WhatsApp.',
        command: 'invalid_location',
      });
      return;
    }

    const locationAddress =
      safeTrim(params.location.address, 255) || safeTrim(params.location.name, 255);

    try {
      const shift =
        session.action === WhatsappClockAction.CLOCK_IN
          ? await this.shiftsService.clockInByUserId(
              params.user.id,
              {
                lat,
                lng,
              },
              {
                ip: params.context?.ip,
                userAgent: `WHATSAPP:${params.integration.phoneNumberId ?? 'unknown'}`,
              },
              params.user.companyId,
            )
          : await this.shiftsService.clockOutByUserId(
              params.user.id,
              {
                lat,
                lng,
              },
              {
                ip: params.context?.ip,
                userAgent: `WHATSAPP:${params.integration.phoneNumberId ?? 'unknown'}`,
              },
              params.user.companyId,
            );

      await this.prisma.whatsappClockSession.update({
        where: { id: session.id },
        data: {
          status: WhatsappClockSessionStatus.COMPLETED,
          locationLat: lat,
          locationLng: lng,
          locationAddress,
          providerMessageId: params.providerMessageId,
          completedAt: new Date(),
          shiftId: shift.id,
        },
      });

      await this.finishInboundLog(params.inboundLogId, WhatsappMessageStatus.PROCESSED);
      await this.sendTextMessage({
        integration: params.integration,
        toPhone: params.fromPhone,
        userId: params.user.id,
        body: this.buildClockConfirmationMessage(session.action, shift),
        command:
          session.action === WhatsappClockAction.CLOCK_IN
            ? 'clock_in_completed'
            : 'clock_out_completed',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      await this.prisma.whatsappClockSession.update({
        where: { id: session.id },
        data: {
          status: WhatsappClockSessionStatus.FAILED,
          locationLat: lat,
          locationLng: lng,
          locationAddress,
          providerMessageId: params.providerMessageId,
        },
      });
      await this.finishInboundLog(params.inboundLogId, WhatsappMessageStatus.FAILED, {
        errorMessage: message,
      });
      await this.sendTextMessage({
        integration: params.integration,
        toPhone: params.fromPhone,
        userId: params.user.id,
        body: `No se pudo completar el fichaje: ${message}`,
        command: 'clock_failed',
      }).catch((sendError) => {
        const sendMessage =
          sendError instanceof Error ? sendError.message : 'Error desconocido';
        this.logger.warn(`No se pudo enviar error de fichaje por WhatsApp: ${sendMessage}`);
      });
    }
  }

  private async beginClockFlow(params: {
    integration: {
      id: string;
      companyId: string;
      phoneNumberId: string | null;
      requireLocation: boolean;
      displayPhoneNumber: string | null;
    };
    user: {
      id: string;
      companyId: string;
      phone: string | null;
    };
    phone: string | null;
    action: WhatsappClockAction;
    command: string;
    inboundLogId: string;
    providerMessageId: string | null;
    context?: WebhookContext;
  }) {
    await this.cancelPendingSessionsForUser(params.integration.companyId, params.user.id);

    if (!params.integration.requireLocation) {
      try {
        const shift =
          params.action === WhatsappClockAction.CLOCK_IN
            ? await this.shiftsService.clockInByUserId(
                params.user.id,
                undefined,
                {
                  ip: params.context?.ip,
                  userAgent: `WHATSAPP:${params.integration.phoneNumberId ?? 'unknown'}`,
                },
                params.user.companyId,
              )
            : await this.shiftsService.clockOutByUserId(
                params.user.id,
                undefined,
                {
                  ip: params.context?.ip,
                  userAgent: `WHATSAPP:${params.integration.phoneNumberId ?? 'unknown'}`,
                },
                params.user.companyId,
              );

        await this.finishInboundLog(params.inboundLogId, WhatsappMessageStatus.PROCESSED);
        await this.sendTextMessage({
          integration: params.integration,
          toPhone: params.phone,
          userId: params.user.id,
          body: this.buildClockConfirmationMessage(params.action, shift),
          command: params.command,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        await this.finishInboundLog(params.inboundLogId, WhatsappMessageStatus.FAILED, {
          errorMessage: message,
        });
        await this.sendTextMessage({
          integration: params.integration,
          toPhone: params.phone,
          userId: params.user.id,
          body: `No se pudo completar el fichaje: ${message}`,
          command: `${params.command}_failed`,
        });
      }
      return;
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.clockSessionTtlMinutes * 60 * 1000,
    );

    await this.prisma.whatsappClockSession.create({
      data: {
        integrationId: params.integration.id,
        companyId: params.integration.companyId,
        userId: params.user.id,
        phone: params.phone ?? params.user.phone ?? 'UNKNOWN',
        action: params.action,
        status: WhatsappClockSessionStatus.PENDING_LOCATION,
        providerMessageId: params.providerMessageId,
        requestedAt: now,
        expiresAt,
      },
    });

    await this.finishInboundLog(params.inboundLogId, WhatsappMessageStatus.PROCESSED);
    await this.sendTextMessage({
      integration: params.integration,
      toPhone: params.phone,
      userId: params.user.id,
      body:
        params.action === WhatsappClockAction.CLOCK_IN
          ? `Para registrar tu entrada, comparte tu ubicación actual por WhatsApp en los próximos ${this.clockSessionTtlMinutes} minutos.`
          : `Para registrar tu salida, comparte tu ubicación actual por WhatsApp en los próximos ${this.clockSessionTtlMinutes} minutos.`,
      command: `${params.command}_request_location`,
    });
  }

  private async cancelPendingSessionsForUser(companyId: string, userId: string) {
    await this.prisma.whatsappClockSession.updateMany({
      where: {
        companyId,
        userId,
        status: WhatsappClockSessionStatus.PENDING_LOCATION,
      },
      data: {
        status: WhatsappClockSessionStatus.CANCELLED,
      },
    });
  }

  private async expirePendingSessions() {
    await this.prisma.whatsappClockSession.updateMany({
      where: {
        status: WhatsappClockSessionStatus.PENDING_LOCATION,
        expiresAt: { lt: new Date() },
      },
      data: {
        status: WhatsappClockSessionStatus.EXPIRED,
      },
    });
  }

  private resolveCommand(normalized: string) {
    if (!normalized) return 'help';
    if (['fichar entrada', 'entrada', 'clock in', 'iniciar turno'].includes(normalized)) {
      return 'clock_in';
    }
    if (['fichar salida', 'salida', 'clock out', 'cerrar turno'].includes(normalized)) {
      return 'clock_out';
    }
    if (['estado', 'status', 'mi estado'].includes(normalized)) {
      return 'status';
    }
    if (['mis horas', 'horas', 'resumen horas'].includes(normalized)) {
      return 'my_hours';
    }
    if (['mis solicitudes', 'solicitudes', 'ultimas solicitudes'].includes(normalized)) {
      return 'my_requests';
    }
    if (['cancelar', 'cancelar fichaje'].includes(normalized)) {
      return 'cancel';
    }
    if (['ayuda', 'help', 'menu'].includes(normalized)) {
      return 'help';
    }
    return 'help';
  }

  private buildHelpMessage() {
    return [
      'Comandos disponibles:',
      '- FICHAR ENTRADA',
      '- FICHAR SALIDA',
      '- ESTADO',
      '- MIS HORAS',
      '- MIS SOLICITUDES',
      '- CANCELAR',
      '',
      'Si quieres fichar, primero escribe el comando y después comparte tu ubicación actual.',
    ].join('\n');
  }

  private async buildStatusMessage(userId: string) {
    const [openShift, pendingSession] = await Promise.all([
      this.shiftsService.getOpenShiftByUserId(userId),
      this.prisma.whatsappClockSession.findFirst({
        where: {
          userId,
          status: WhatsappClockSessionStatus.PENDING_LOCATION,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const lines = [] as string[];
    if (openShift) {
      lines.push(`Tienes un turno abierto desde ${formatMadridDateTime(openShift.startAt)}.`);
    } else {
      lines.push('Ahora mismo no tienes ningún turno abierto.');
    }

    if (pendingSession) {
      lines.push(
        `Hay un fichaje pendiente de ubicación hasta ${formatMadridDateTime(pendingSession.expiresAt)}.`,
      );
    }

    return lines.join('\n');
  }

  private async buildHoursMessage(userId: string) {
    const progress = await this.usersService.getProgressByUserId(userId);
    const lines = [
      `Horas semanales trabajadas: ${progress.weekly.workedHours}h / ${progress.weekly.limitHours}h.`,
      `Horas extra aprobadas: ${progress.overtimeBank.approvedHours}h.`,
      `Ajuste de bolsa: ${progress.overtimeBank.adjustmentHours}h.`,
    ];

    if (progress.workerGroup === 'INTERN') {
      lines.push(
        `Prácticas consumidas: ${progress.internship.consumedHours}h de ${progress.internship.totalHours}h. Pendientes: ${progress.internship.pendingHours}h.`,
      );
    }

    return lines.join('\n');
  }

  private async buildRequestsMessage(userId: string) {
    const requests = await this.prisma.request.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        type: true,
        status: true,
        startAt: true,
        endAt: true,
      },
    });

    if (!requests.length) {
      return 'No tienes solicitudes registradas recientemente.';
    }

    return [
      'Últimas solicitudes:',
      ...requests.map(
        (request) =>
          `- ${request.type}: ${request.status} (${formatMadridDateTime(request.startAt)} -> ${formatMadridDateTime(request.endAt)})`,
      ),
    ].join('\n');
  }

  private buildClockConfirmationMessage(
    action: WhatsappClockAction,
    shift: { id: string; startAt: Date; endAt: Date | null },
  ) {
    if (action === WhatsappClockAction.CLOCK_IN) {
      return `Entrada registrada correctamente a las ${formatMadridDateTime(shift.startAt)}.`;
    }

    const workedMinutes = minutesBetween(shift.startAt, shift.endAt);
    const workedHours = (workedMinutes / 60).toFixed(2);
    return `Salida registrada correctamente a las ${formatMadridDateTime(shift.endAt ?? new Date())}. Tiempo trabajado en este turno: ${workedHours}h.`;
  }

  private extractIncomingMessageEvents(payload: unknown): IncomingMessageEvent[] {
    if (!payload || typeof payload !== 'object') return [];
    const entries = Array.isArray((payload as { entry?: unknown[] }).entry)
      ? (payload as { entry: unknown[] }).entry
      : [];
    const events: IncomingMessageEvent[] = [];

    for (const entry of entries) {
      const changes = Array.isArray((entry as { changes?: unknown[] }).changes)
        ? (entry as { changes: unknown[] }).changes
        : [];

      for (const change of changes) {
        const value = (change as { value?: Record<string, unknown> }).value ?? {};
        const metadata = (value.metadata as Record<string, unknown> | undefined) ?? {};
        const messages = Array.isArray(value.messages) ? value.messages : [];

        for (const message of messages) {
          events.push({
            metadataPhoneNumberId:
              typeof metadata.phone_number_id === 'string'
                ? metadata.phone_number_id
                : null,
            metadataDisplayPhoneNumber:
              typeof metadata.display_phone_number === 'string'
                ? metadata.display_phone_number
                : null,
            message: (message as MetaIncomingMessage) ?? {},
            rawPayload: value,
          });
        }
      }
    }

    return events;
  }

  private async requireActiveIntegrationByCompanyId(companyId: string) {
    const integration = await this.findActiveIntegrationByCompanyId(companyId);
    if (!integration) {
      throw new BadRequestException(
        'La empresa no tiene WhatsApp activo o falta configurar el Phone Number ID',
      );
    }
    return integration;
  }

  private async findActiveIntegrationByCompanyId(companyId: string) {
    return this.prisma.whatsappIntegration.findFirst({
      where: {
        companyId,
        provider: WhatsappProvider.META_CLOUD_API,
        isEnabled: true,
        phoneNumberId: { not: null },
      },
    });
  }

  private async finishInboundLog(
    logId: string,
    status: WhatsappMessageStatus,
    extra?: {
      errorMessage?: string | null;
      command?: string | null;
    },
  ) {
    await this.prisma.whatsappMessageLog.update({
      where: { id: logId },
      data: {
        status,
        errorMessage:
          extra?.errorMessage !== undefined ? safeTrim(extra.errorMessage, 500) : undefined,
        command: extra?.command !== undefined ? safeTrim(extra.command, 120) : undefined,
      },
    });
  }

  private async sendTextMessage(params: {
    integration: {
      id: string;
      companyId: string;
      phoneNumberId: string | null;
      displayPhoneNumber: string | null;
    };
    toPhone: string | null;
    body: string;
    userId?: string | null;
    command?: string | null;
  }) {
    const body = safeTrim(params.body, 2000);
    const toPhone = params.toPhone ? normalizeWhatsappSender(params.toPhone) : null;

    if (!body || !toPhone) {
      throw new BadRequestException('Mensaje o teléfono de destino inválido');
    }
    if (!params.integration.phoneNumberId) {
      throw new BadRequestException('Falta el Phone Number ID en la integración');
    }
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'WhatsApp está desactivado globalmente en el backend',
      );
    }
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      throw new ServiceUnavailableException(
        'Falta WHATSAPP_ACCESS_TOKEN para enviar mensajes',
      );
    }

    const response = await fetch(
      `${this.graphApiBaseUrl}/${this.graphApiVersion}/${params.integration.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toPhone.replace(/^\+/, ''),
          type: 'text',
          text: {
            body,
          },
        }),
      },
    );

    const payload = await response.json().catch(() => null);
    const providerMessageId =
      Array.isArray(payload?.messages) && typeof payload.messages[0]?.id === 'string'
        ? payload.messages[0].id
        : null;

    await this.prisma.whatsappMessageLog.create({
      data: {
        integrationId: params.integration.id,
        companyId: params.integration.companyId,
        userId: params.userId ?? null,
        direction: WhatsappMessageDirection.OUTBOUND,
        status: response.ok
          ? WhatsappMessageStatus.SENT
          : WhatsappMessageStatus.FAILED,
        messageType: 'text',
        command: safeTrim(params.command, 120),
        body,
        fromPhone: params.integration.displayPhoneNumber,
        toPhone,
        providerMessageId,
        payload: (payload ?? {}) as Prisma.InputJsonValue,
        errorMessage: response.ok
          ? null
          : safeTrim(payload?.error?.message ?? `HTTP ${response.status}`, 500),
      },
    });

    if (!response.ok) {
      throw new BadRequestException(
        payload?.error?.message || 'No se pudo enviar el mensaje de WhatsApp',
      );
    }

    await this.prisma.whatsappIntegration.update({
      where: { id: params.integration.id },
      data: {
        lastOutboundAt: new Date(),
      },
    });

    return { providerMessageId };
  }
}
