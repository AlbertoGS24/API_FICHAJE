import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestWithAgent } from './agent-request';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function isEnabled(value: string | undefined) {
  return TRUE_VALUES.has((value ?? '').trim().toLowerCase());
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function requestIp(request: RequestWithAgent) {
  const forwarded = request.header('x-forwarded-for') ?? '';
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.ip || request.socket?.remoteAddress || null;
}

@Injectable()
export class AgentAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private async logAccess(
    request: RequestWithAgent,
    data: {
      status: 'ALLOWED' | 'DENIED';
      reason?: string;
      integrationId?: string;
      companyId?: string;
    },
  ) {
    try {
      await this.prisma.agentAccessLog.create({
        data: {
          integrationId: data.integrationId,
          companyId: data.companyId,
          provider: 'OPENCLAW',
          status: data.status,
          reason: data.reason,
          method: request.method ?? 'UNKNOWN',
          path: request.originalUrl ?? request.url ?? '/agent',
          ip: requestIp(request),
          userAgent: request.header('user-agent') ?? null,
        },
      });
    } catch {
      // La auditoría no debe bloquear la autenticación del agente.
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAgent>();

    if (!isEnabled(this.config.get<string>('OPENCLAW_ENABLED'))) {
      await this.logAccess(request, {
        status: 'DENIED',
        reason: 'OPENCLAW_DISABLED',
      });
      throw new ServiceUnavailableException('Integración OpenClaw desactivada');
    }

    const authHeader = request.header('authorization') ?? '';
    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    const incomingToken = match?.[1]?.trim() ?? '';

    if (!incomingToken) {
      await this.logAccess(request, {
        status: 'DENIED',
        reason: 'MISSING_TOKEN',
      });
      throw new UnauthorizedException('Token OpenClaw inválido');
    }

    const integration = await this.prisma.agentIntegration.findUnique({
      where: { tokenHash: hashToken(incomingToken) },
      select: {
        id: true,
        provider: true,
        isEnabled: true,
        scopes: true,
        companyId: true,
        company: {
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    if (!integration || integration.provider !== 'OPENCLAW') {
      await this.logAccess(request, {
        status: 'DENIED',
        reason: 'INVALID_TOKEN',
      });
      throw new UnauthorizedException('Token OpenClaw inválido');
    }

    if (!integration.isEnabled) {
      await this.logAccess(request, {
        status: 'DENIED',
        reason: 'TOKEN_REVOKED',
        integrationId: integration.id,
        companyId: integration.companyId,
      });
      throw new ServiceUnavailableException('Integración OpenClaw revocada');
    }

    if (!integration.company.isActive) {
      await this.logAccess(request, {
        status: 'DENIED',
        reason: 'COMPANY_DISABLED',
        integrationId: integration.id,
        companyId: integration.companyId,
      });
      throw new ServiceUnavailableException('Empresa OpenClaw desactivada');
    }

    await this.prisma.agentIntegration.update({
      where: { id: integration.id },
      data: { lastUsedAt: new Date() },
    });

    await this.logAccess(request, {
      status: 'ALLOWED',
      integrationId: integration.id,
      companyId: integration.companyId,
    });

    request.agent = {
      integrationId: integration.id,
      provider: integration.provider,
      companyId: integration.companyId,
      scopes: integration.scopes,
      company: integration.company,
    };
    return true;
  }
}
