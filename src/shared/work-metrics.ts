import { PrismaService } from '../prisma/prisma.service';
import { DateTime } from 'luxon';

const APP_TIMEZONE = 'Europe/Madrid';

function dateKeyFor(date: Date) {
  return DateTime.fromJSDate(date).setZone(APP_TIMEZONE).toFormat('yyyy-LL-dd');
}

function minutesFromTimeRange(
  startTime?: string | null,
  endTime?: string | null,
) {
  if (!startTime || !endTime) return 0;
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  if (
    !Number.isFinite(startHour) ||
    !Number.isFinite(startMinute) ||
    !Number.isFinite(endHour) ||
    !Number.isFinite(endMinute)
  ) {
    return 0;
  }

  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return end > start ? end - start : 0;
}

export async function calculateExpectedWorkMinutes(params: {
  prisma: PrismaService;
  companyId: string;
  userIds: string[];
  from: Date;
  toExclusive: Date;
}) {
  if (!params.userIds.length) {
    return new Map<string, number>();
  }

  const [holidays, entries] = await Promise.all([
    params.prisma.holiday.findMany({
      where: {
        companyId: params.companyId,
        date: {
          gte: params.from,
          lt: params.toExclusive,
        },
      },
      select: {
        date: true,
      },
    }),
    params.prisma.scheduleEntry.findMany({
      where: {
        userId: { in: params.userIds },
        type: 'WORK',
        date: {
          gte: params.from,
          lt: params.toExclusive,
        },
      },
      select: {
        userId: true,
        date: true,
        startTime: true,
        endTime: true,
      },
    }),
  ]);

  const holidayKeys = new Set(
    holidays.map((holiday) => dateKeyFor(holiday.date)),
  );
  const result = new Map<string, number>();

  for (const userId of params.userIds) {
    result.set(userId, 0);
  }

  for (const entry of entries) {
    if (holidayKeys.has(dateKeyFor(entry.date))) {
      continue;
    }
    result.set(
      entry.userId,
      (result.get(entry.userId) ?? 0) +
        minutesFromTimeRange(entry.startTime, entry.endTime),
    );
  }

  return result;
}

export async function calculateVacationDayUsage(params: {
  prisma: PrismaService;
  userId: string;
  from: Date;
  toExclusive: Date;
}) {
  const [approvedEntries, pendingRequests] = await Promise.all([
    params.prisma.scheduleEntry.count({
      where: {
        userId: params.userId,
        type: 'VACATION',
        date: {
          gte: params.from,
          lt: params.toExclusive,
        },
      },
    }),
    params.prisma.request.findMany({
      where: {
        userId: params.userId,
        type: 'VACATION',
        status: 'PENDING',
        startAt: { lt: params.toExclusive },
        endAt: { gte: params.from },
      },
      select: {
        startAt: true,
        endAt: true,
      },
    }),
  ]);

  const pendingDays = pendingRequests.reduce((acc, request) => {
    const start = DateTime.fromJSDate(request.startAt)
      .setZone(APP_TIMEZONE)
      .startOf('day');
    const end = DateTime.fromJSDate(request.endAt)
      .setZone(APP_TIMEZONE)
      .startOf('day');
    const diffDays = Number(end.diff(start, 'days').days);
    return acc + Math.max(1, Math.floor(diffDays) + 1);
  }, 0);

  return {
    approvedDays: approvedEntries,
    pendingDays,
  };
}

export async function calculateOvertimeMinutes(params: {
  prisma: PrismaService;
  userId: string;
  from: Date;
  toExclusive: Date;
}) {
  const [approvedRequests, pendingRequests] = await Promise.all([
    params.prisma.request.findMany({
      where: {
        userId: params.userId,
        type: 'OVERTIME',
        status: 'APPROVED',
        startAt: { gte: params.from, lt: params.toExclusive },
      },
      select: { startAt: true, endAt: true },
    }),
    params.prisma.request.findMany({
      where: {
        userId: params.userId,
        type: 'OVERTIME',
        status: 'PENDING',
        startAt: { gte: params.from, lt: params.toExclusive },
      },
      select: { startAt: true, endAt: true },
    }),
  ]);

  const minutesFor = (requests: Array<{ startAt: Date; endAt: Date }>) =>
    requests.reduce((acc, request) => {
      const diff =
        new Date(request.endAt).getTime() - new Date(request.startAt).getTime();
      return acc + (diff > 0 ? Math.ceil(diff / 60000) : 0);
    }, 0);

  return {
    approvedMinutes: minutesFor(approvedRequests),
    pendingMinutes: minutesFor(pendingRequests),
  };
}
