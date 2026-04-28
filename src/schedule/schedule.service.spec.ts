import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { ScheduleService } from './schedule.service';

type MockFn = jest.Mock<any, any>;

function createPrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    scheduleEntry: {
      upsert: jest.fn(),
    },
    scheduleTemplateEntry: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    holiday: {
      findMany: jest.fn(),
    },
  };
}

function createUsersServiceMock() {
  return {
    findOrCreateByFirebaseUid: jest.fn(),
  };
}

function createService() {
  const prisma = createPrismaMock();
  const usersService = createUsersServiceMock();
  const service = new ScheduleService(
    prisma as unknown as PrismaService,
    usersService as unknown as UsersService,
  );

  (prisma.user.findUnique as MockFn).mockResolvedValue({
    id: 'admin-1',
    role: 'ADMIN',
    companyId: 'company-1',
    email: 'admin@empresa.com',
    name: 'Admin',
  });
  (prisma.user.findFirst as MockFn).mockResolvedValue({
    id: 'user-1',
    name: 'Empleado',
    email: 'empleado@empresa.com',
    role: 'EMPLOYEE',
    workerGroup: 'EMPLOYEE',
  });

  return { service, prisma };
}

describe('ScheduleService planned times', () => {
  it('stores planned clock-in and clock-out for work schedule entries', async () => {
    const { service, prisma } = createService();
    (prisma.scheduleEntry.upsert as MockFn).mockResolvedValue({
      id: 'entry-1',
      date: new Date('2026-04-20T00:00:00.000Z'),
      type: 'WORK',
      startTime: '09:00',
      endTime: '17:30',
      notes: null,
    });

    const result = await service.upsertForAdmin('uid-admin', {
      userId: 'user-1',
      date: '2026-04-20',
      type: 'WORK',
      startTime: '09:00',
      endTime: '17:30',
    });

    expect(prisma.scheduleEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          startTime: '09:00',
          endTime: '17:30',
        }),
        create: expect.objectContaining({
          startTime: '09:00',
          endTime: '17:30',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        plannedStartTime: '09:00',
        plannedEndTime: '17:30',
        plannedMinutes: 510,
        plannedDurationLabel: '8 h 30 min',
      }),
    );
  });

  it('clears planned times for non-work schedule entries', async () => {
    const { service, prisma } = createService();
    (prisma.scheduleEntry.upsert as MockFn).mockResolvedValue({
      id: 'entry-2',
      date: new Date('2026-04-21T00:00:00.000Z'),
      type: 'VACATION',
      startTime: null,
      endTime: null,
      notes: null,
    });

    await service.upsertForAdmin('uid-admin', {
      userId: 'user-1',
      date: '2026-04-21',
      type: 'VACATION',
      startTime: '09:00',
      endTime: '17:00',
    });

    expect(prisma.scheduleEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          startTime: null,
          endTime: null,
        }),
        create: expect.objectContaining({
          startTime: null,
          endTime: null,
        }),
      }),
    );
  });

  it('rejects planned clock-out before planned clock-in', async () => {
    const { service } = createService();

    await expect(
      service.upsertForAdmin('uid-admin', {
        userId: 'user-1',
        date: '2026-04-22',
        type: 'WORK',
        startTime: '18:00',
        endTime: '09:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
