import {
  calculateExpectedWorkMinutes,
  calculateOvertimeMinutes,
  calculateVacationDayUsage,
} from './work-metrics';

describe('work-metrics', () => {
  it('excluye festivos del calculo de horas esperadas', async () => {
    const prisma = {
      holiday: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ date: new Date('2026-05-02T00:00:00.000Z') }]),
      },
      scheduleEntry: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'user-1',
            date: new Date('2026-05-01T00:00:00.000Z'),
            startTime: '09:00',
            endTime: '18:00',
          },
          {
            userId: 'user-1',
            date: new Date('2026-05-02T00:00:00.000Z'),
            startTime: '09:00',
            endTime: '18:00',
          },
        ]),
      },
    };

    const result = await calculateExpectedWorkMinutes({
      prisma: prisma as any,
      companyId: 'company-1',
      userIds: ['user-1'],
      from: new Date('2026-05-01T00:00:00.000Z'),
      toExclusive: new Date('2026-05-03T00:00:00.000Z'),
    });

    expect(result.get('user-1')).toBe(540);
  });

  it('calcula vacaciones aprobadas y pendientes', async () => {
    const prisma = {
      scheduleEntry: {
        count: jest.fn().mockResolvedValue(3),
      },
      request: {
        findMany: jest.fn().mockResolvedValue([
          {
            startAt: new Date('2026-08-10T00:00:00.000Z'),
            endAt: new Date('2026-08-12T00:00:00.000Z'),
          },
        ]),
      },
    };

    const result = await calculateVacationDayUsage({
      prisma: prisma as any,
      userId: 'user-1',
      from: new Date('2026-01-01T00:00:00.000Z'),
      toExclusive: new Date('2027-01-01T00:00:00.000Z'),
    });

    expect(result).toEqual({
      approvedDays: 3,
      pendingDays: 3,
    });
  });

  it('calcula horas extra aprobadas y pendientes en minutos', async () => {
    const prisma = {
      request: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              startAt: new Date('2026-06-01T08:00:00.000Z'),
              endAt: new Date('2026-06-01T10:30:00.000Z'),
            },
          ])
          .mockResolvedValueOnce([
            {
              startAt: new Date('2026-06-03T18:00:00.000Z'),
              endAt: new Date('2026-06-03T19:15:00.000Z'),
            },
          ]),
      },
    };

    const result = await calculateOvertimeMinutes({
      prisma: prisma as any,
      userId: 'user-1',
      from: new Date('2026-06-01T00:00:00.000Z'),
      toExclusive: new Date('2026-07-01T00:00:00.000Z'),
    });

    expect(result).toEqual({
      approvedMinutes: 150,
      pendingMinutes: 75,
    });
  });
});
