import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentService } from './agent.service';
import type { AgentContext } from './agent-request';

type MockFn = jest.Mock<any, any>;

function createPrismaMock() {
  return {
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    request: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    shift: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    scheduleEntry: {
      groupBy: jest.fn(),
    },
  };
}

function createAgent(scopes: string[] = ['read:requests', 'read:shifts']): AgentContext {
  return {
    integrationId: 'integration-1',
    provider: 'OPENCLAW',
    companyId: 'company-1',
    scopes,
    company: {
      id: 'company-1',
      code: 'DEFAULT',
      name: 'Empresa Demo',
      isActive: true,
    },
  };
}

function createService() {
  const prisma = createPrismaMock();
  const service = new AgentService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe('AgentService', () => {
  it('scopes pending requests to token company', async () => {
    const { service, prisma } = createService();
    (prisma.request.findMany as MockFn).mockResolvedValue([]);

    const result = await service.pendingRequests(createAgent(), '10');

    expect(prisma.request.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          user: { companyId: 'company-1' },
          status: 'PENDING',
        },
        take: 10,
      }),
    );
    expect(result.company.id).toBe('company-1');
  });

  it('rejects endpoints outside token scopes', async () => {
    const { service } = createService();

    await expect(
      service.pendingRequests(createAgent(['read:summary']), '10'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('does not expose raw geolocation in today shifts', async () => {
    const { service, prisma } = createService();
    (prisma.shift.findMany as MockFn).mockResolvedValue([
      {
        id: 'shift-1',
        startAt: new Date('2026-04-20T07:00:00.000Z'),
        endAt: new Date('2026-04-20T15:00:00.000Z'),
        isSuspicious: false,
        riskScore: 0,
        workplace: {
          id: 'workplace-1',
          name: 'Oficina',
          addressLabel: 'Madrid',
        },
        user: { id: 'user-1', name: 'Empleado', email: 'empleado@empresa.com' },
      },
    ]);

    const result = await service.todayShifts(createAgent(), '5');

    expect(prisma.shift.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ user: { companyId: 'company-1' } }),
        take: 5,
      }),
    );
    expect(result.shifts[0]).not.toHaveProperty('startLat');
    expect(result.shifts[0]).not.toHaveProperty('startLng');
    expect(result.shifts[0].workedMinutes).toBe(480);
  });
});
