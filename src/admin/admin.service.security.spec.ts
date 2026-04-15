import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduleService } from '../schedule/schedule.service';
import { MailService } from '../mail/mail.service';

type MockFn = jest.Mock<any, any>;

function createPrismaMock() {
  const tx = {
    user: {
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    request: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    shift: {
      findMany: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
    },
    workplace: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(async (cb: (tx: any) => unknown) => cb(tx)),
  };

  return { prisma, tx };
}

function createScheduleMock() {
  return {
    syncRangeByType: jest.fn(),
  };
}

function createMailMock() {
  return {
    sendTextEmail: jest.fn(),
  };
}

function mockAdmin(prisma: ReturnType<typeof createPrismaMock>['prisma']) {
  (prisma.user.findUnique as MockFn).mockResolvedValue({
    id: 'admin-1',
    email: 'admin@empresa-a.com',
    name: 'Admin A',
    role: 'ADMIN',
    companyId: 'company-a',
  });
}

describe('AdminService Security (multiempresa)', () => {
  it('scopes getRequests by admin companyId', async () => {
    const { prisma } = createPrismaMock();
    const schedule = createScheduleMock();
    const mail = createMailMock();
    mockAdmin(prisma);
    (prisma.request.findMany as MockFn).mockResolvedValue([]);
    const service = new AdminService(
      prisma as unknown as PrismaService,
      schedule as unknown as ScheduleService,
      mail as unknown as MailService,
    );

    await service.getRequests('uid-admin-a', 'PENDING', 'VACATION', 'EMPLOYEE');

    expect(prisma.request.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: { companyId: 'company-a' },
          status: 'PENDING',
          type: 'VACATION',
          source: 'EMPLOYEE',
        }),
      }),
    );
  });

  it('rejects auditLogs targetUserId when user is outside admin company', async () => {
    const { prisma } = createPrismaMock();
    const schedule = createScheduleMock();
    const mail = createMailMock();
    mockAdmin(prisma);
    (prisma.user.findFirst as MockFn).mockResolvedValue(null);
    const service = new AdminService(
      prisma as unknown as PrismaService,
      schedule as unknown as ScheduleService,
      mail as unknown as MailService,
    );

    await expect(
      service.auditLogs('uid-admin-a', 'user-company-b', '20'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it('updates user settings with company-scoped where clause', async () => {
    const { prisma, tx } = createPrismaMock();
    const schedule = createScheduleMock();
    const mail = createMailMock();
    mockAdmin(prisma);
    (prisma.user.findFirst as MockFn).mockResolvedValue({
      id: 'user-1',
      role: 'EMPLOYEE',
      workerGroup: 'EMPLOYEE',
      internshipTotalHours: null,
    });
    (tx.user.updateMany as MockFn).mockResolvedValue({ count: 1 });
    (tx.user.findFirst as MockFn).mockResolvedValue({
      id: 'user-1',
      email: 'empleado@empresa-a.com',
      name: 'Empleado A',
      role: 'EMPLOYEE',
      workerGroup: 'INTERN',
      internshipTotalHours: 120,
    });
    (tx.auditLog.create as MockFn).mockResolvedValue({
      id: 'audit-1',
    });
    const service = new AdminService(
      prisma as unknown as PrismaService,
      schedule as unknown as ScheduleService,
      mail as unknown as MailService,
    );

    await service.updateUserSettings('uid-admin-a', 'user-1', {
      workerGroup: 'INTERN',
      internshipTotalHours: 120,
    });

    expect(tx.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1', companyId: 'company-a' },
      }),
    );
  });

  it('approves requests only with scoped request/user pair', async () => {
    const { prisma } = createPrismaMock();
    const schedule = createScheduleMock();
    const mail = createMailMock();
    mockAdmin(prisma);
    (prisma.request.findFirst as MockFn)
      .mockResolvedValueOnce({ id: 'req-1', userId: 'user-1' })
      .mockResolvedValueOnce({
        id: 'req-1',
        userId: 'user-1',
        status: 'APPROVED',
      });
    (prisma.request.updateMany as MockFn).mockResolvedValue({ count: 1 });
    const service = new AdminService(
      prisma as unknown as PrismaService,
      schedule as unknown as ScheduleService,
      mail as unknown as MailService,
    );

    await service.approveRequest('uid-admin-a', 'req-1', {
      reviewComment: 'ok',
    });

    expect(prisma.request.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-1', userId: 'user-1' },
      }),
    );
  });

  it('scopes suspicious shifts by companyId and sanitizes risk reasons', async () => {
    const { prisma } = createPrismaMock();
    const schedule = createScheduleMock();
    const mail = createMailMock();
    mockAdmin(prisma);
    (prisma.shift.findMany as MockFn).mockResolvedValue([
      {
        id: 'shift-1',
        userId: 'user-1',
        startAt: new Date('2026-03-17T08:00:00.000Z'),
        endAt: new Date('2026-03-17T16:00:00.000Z'),
        startLat: null,
        startLng: null,
        endLat: null,
        endLng: null,
        accuracy: null,
        startDistanceMeters: null,
        endDistanceMeters: null,
        startInsideGeofence: null,
        endInsideGeofence: null,
        riskScore: 60,
        riskReasons: ['OUTSIDE_GEOFENCE_START', 12, null],
        startIp: null,
        endIp: null,
        startUserAgent: null,
        endUserAgent: null,
        user: {
          id: 'user-1',
          name: 'Empleado A',
          email: 'empleado@empresa-a.com',
        },
      },
    ]);
    const service = new AdminService(
      prisma as unknown as PrismaService,
      schedule as unknown as ScheduleService,
      mail as unknown as MailService,
    );

    const result = await service.suspiciousShifts(
      'uid-admin-a',
      '2026-03-17',
      '2026-03-17',
      '10',
    );

    expect(prisma.shift.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isSuspicious: true,
          user: { companyId: 'company-a' },
        }),
      }),
    );
    expect(result[0].riskReasons).toEqual(['OUTSIDE_GEOFENCE_START']);
  });

  it('scopes workplaces by admin companyId', async () => {
    const { prisma } = createPrismaMock();
    const schedule = createScheduleMock();
    const mail = createMailMock();
    mockAdmin(prisma);
    (prisma.workplace.findMany as MockFn).mockResolvedValue([]);
    const service = new AdminService(
      prisma as unknown as PrismaService,
      schedule as unknown as ScheduleService,
      mail as unknown as MailService,
    );

    await service.listWorkplaces('uid-admin-a');

    expect(prisma.workplace.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'company-a' },
      }),
    );
  });
});
