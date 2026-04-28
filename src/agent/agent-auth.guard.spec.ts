import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AgentAuthGuard } from './agent-auth.guard';
import type { RequestWithAgent } from './agent-request';

function createContext(authHeader?: string) {
  const request = {
    header: (name: string) =>
      name.toLowerCase() === 'authorization' ? authHeader : undefined,
  } as RequestWithAgent;

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;

  return { context, request };
}

function createConfig(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function createPrismaMock() {
  return {
    agentIntegration: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    agentAccessLog: {
      create: jest.fn(),
    },
  };
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

describe('AgentAuthGuard', () => {
  it('rejects requests when OpenClaw is disabled', async () => {
    const prisma = createPrismaMock();
    const guard = new AgentAuthGuard(
      createConfig({ OPENCLAW_ENABLED: 'false' }),
      prisma as unknown as PrismaService,
    );

    await expect(
      guard.canActivate(createContext('Bearer secret').context),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('rejects invalid bearer token', async () => {
    const prisma = createPrismaMock();
    prisma.agentIntegration.findUnique.mockResolvedValue(null);
    const guard = new AgentAuthGuard(
      createConfig({ OPENCLAW_ENABLED: 'true' }),
      prisma as unknown as PrismaService,
    );

    await expect(
      guard.canActivate(createContext('Bearer wrong').context),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.agentIntegration.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: sha256('wrong') } }),
    );
  });

  it('allows a valid company-scoped bearer token', async () => {
    const prisma = createPrismaMock();
    prisma.agentIntegration.findUnique.mockResolvedValue({
      id: 'integration-1',
      provider: 'OPENCLAW',
      isEnabled: true,
      scopes: ['read:summary'],
      companyId: 'company-1',
      company: {
        id: 'company-1',
        code: 'DEFAULT',
        name: 'Empresa principal',
        isActive: true,
      },
    });
    prisma.agentIntegration.update.mockResolvedValue({});
    const guard = new AgentAuthGuard(
      createConfig({ OPENCLAW_ENABLED: 'true' }),
      prisma as unknown as PrismaService,
    );
    const { context, request } = createContext('Bearer secret');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.agent).toEqual(
      expect.objectContaining({
        integrationId: 'integration-1',
        companyId: 'company-1',
        scopes: ['read:summary'],
      }),
    );
    expect(prisma.agentIntegration.update).toHaveBeenCalledWith({
      where: { id: 'integration-1' },
      data: { lastUsedAt: expect.any(Date) },
    });
  });
});
