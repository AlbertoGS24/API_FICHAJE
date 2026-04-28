import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';
import type { AgentContext, AgentScope } from './agent-request';

const APP_TIMEZONE = 'Europe/Madrid';
const MAX_LIST_LIMIT = 50;

function clampLimit(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), MAX_LIST_LIMIT);
}

function parseMonth(month?: string) {
  const raw =
    month?.trim() || DateTime.now().setZone(APP_TIMEZONE).toFormat('yyyy-LL');
  const parsed = DateTime.fromFormat(raw, 'yyyy-LL', { zone: APP_TIMEZONE });

  if (!parsed.isValid) {
    throw new BadRequestException('El mes debe tener formato YYYY-MM');
  }

  const start = parsed.startOf('month');
  return {
    month: start.toFormat('yyyy-LL'),
    from: start.toUTC().toJSDate(),
    to: start.plus({ months: 1 }).toUTC().toJSDate(),
  };
}

function currentDayRange() {
  const start = DateTime.now().setZone(APP_TIMEZONE).startOf('day');
  return {
    from: start.toUTC().toJSDate(),
    to: start.plus({ days: 1 }).toUTC().toJSDate(),
  };
}

function currentWeekRange() {
  const start = DateTime.now().setZone(APP_TIMEZONE).startOf('week');
  return {
    from: start.toUTC().toJSDate(),
    to: start.plus({ weeks: 1 }).toUTC().toJSDate(),
  };
}

function minutesBetween(startAt: Date, endAt: Date | null) {
  if (!endAt) return 0;
  const diff = endAt.getTime() - startAt.getTime();
  return diff > 0 ? Math.ceil(diff / 60000) : 0;
}

function formatDateKey(date: Date) {
  return DateTime.fromJSDate(date).setZone(APP_TIMEZONE).toFormat('yyyy-LL-dd');
}

function plannedMinutes(startTime: string | null, endTime: string | null) {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const minutes = eh * 60 + em - (sh * 60 + sm);
  return minutes > 0 ? minutes : null;
}

function assertScope(agent: AgentContext, scope: AgentScope) {
  if (!agent.scopes.includes(scope)) {
    throw new ForbiddenException(
      `La integración OpenClaw no tiene permiso ${scope}`,
    );
  }
}

@Injectable()
export class AgentService {
  constructor(private readonly prisma: PrismaService) {}

  status(agent: AgentContext) {
    return {
      ok: true,
      provider: 'openclaw',
      mode: 'read_only',
      integration: {
        id: agent.integrationId,
        scopes: agent.scopes,
      },
      company: agent.company,
      timestamp: new Date().toISOString(),
    };
  }

  async companySummary(agent: AgentContext) {
    assertScope(agent, 'read:summary');
    const today = currentDayRange();
    const week = currentWeekRange();

    const [
      employees,
      admins,
      interns,
      pendingRequests,
      openShifts,
      suspiciousWeek,
      todaySchedule,
    ] = await Promise.all([
      this.prisma.user.count({ where: { companyId: agent.companyId } }),
      this.prisma.user.count({
        where: { companyId: agent.companyId, role: 'ADMIN' },
      }),
      this.prisma.user.count({
        where: { companyId: agent.companyId, workerGroup: 'INTERN' },
      }),
      this.prisma.request.count({
        where: { user: { companyId: agent.companyId }, status: 'PENDING' },
      }),
      this.prisma.shift.count({
        where: { user: { companyId: agent.companyId }, endAt: null },
      }),
      this.prisma.shift.count({
        where: {
          user: { companyId: agent.companyId },
          isSuspicious: true,
          startAt: { gte: week.from, lt: week.to },
        },
      }),
      this.prisma.scheduleEntry.groupBy({
        by: ['type'],
        where: {
          user: { companyId: agent.companyId },
          date: { gte: today.from, lt: today.to },
        },
        _count: { _all: true },
      }),
    ]);

    return {
      company: agent.company,
      generatedAt: new Date().toISOString(),
      totals: {
        users: employees,
        admins,
        interns,
        pendingRequests,
        openShifts,
        suspiciousShiftsThisWeek: suspiciousWeek,
      },
      todaySchedule: todaySchedule.map((item) => ({
        type: item.type,
        count: item._count._all,
      })),
    };
  }

  async pendingRequests(agent: AgentContext, limitInput?: string) {
    assertScope(agent, 'read:requests');
    const limit = clampLimit(limitInput, 20);
    const requests = await this.prisma.request.findMany({
      where: {
        user: { companyId: agent.companyId },
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        source: true,
        startAt: true,
        endAt: true,
        comment: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            workerGroup: true,
          },
        },
      },
    });

    return {
      company: agent.company,
      limit,
      count: requests.length,
      requests,
    };
  }

  async todayShifts(agent: AgentContext, limitInput?: string) {
    assertScope(agent, 'read:shifts');
    const limit = clampLimit(limitInput, 50);
    const today = currentDayRange();
    const shifts = await this.prisma.shift.findMany({
      where: {
        user: { companyId: agent.companyId },
        startAt: { gte: today.from, lt: today.to },
      },
      orderBy: { startAt: 'desc' },
      take: limit,
      select: {
        id: true,
        startAt: true,
        endAt: true,
        isSuspicious: true,
        riskScore: true,
        workplace: {
          select: {
            id: true,
            name: true,
            addressLabel: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      company: agent.company,
      day: DateTime.fromJSDate(today.from)
        .setZone(APP_TIMEZONE)
        .toFormat('yyyy-LL-dd'),
      limit,
      count: shifts.length,
      shifts: shifts.map((shift) => ({
        id: shift.id,
        user: shift.user,
        status: shift.endAt ? 'CLOSED' : 'OPEN',
        startAt: shift.startAt,
        endAt: shift.endAt,
        workedMinutes: minutesBetween(shift.startAt, shift.endAt),
        isSuspicious: shift.isSuspicious,
        riskScore: shift.riskScore,
        workplace: shift.workplace,
      })),
    };
  }

  async scheduleMonth(
    agent: AgentContext,
    input: {
      month?: string;
      userId?: string;
      userEmail?: string;
      limit?: string;
    },
  ) {
    assertScope(agent, 'read:schedule');
    const month = parseMonth(input.month);
    const limit = clampLimit(input.limit, 50);

    const userWhere = input.userId
      ? { id: input.userId, companyId: agent.companyId }
      : input.userEmail
        ? { email: input.userEmail, companyId: agent.companyId }
        : { companyId: agent.companyId };

    const users = await this.prisma.user.findMany({
      where: userWhere,
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        workerGroup: true,
        scheduleEntries: {
          where: {
            date: { gte: month.from, lt: month.to },
          },
          orderBy: { date: 'asc' },
          select: {
            id: true,
            date: true,
            type: true,
            startTime: true,
            endTime: true,
            notes: true,
          },
        },
      },
    });

    return {
      company: agent.company,
      month: month.month,
      limit,
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        workerGroup: user.workerGroup,
        entries: user.scheduleEntries.map((entry) => ({
          id: entry.id,
          dateKey: formatDateKey(entry.date),
          type: entry.type,
          plannedStartTime: entry.startTime,
          plannedEndTime: entry.endTime,
          plannedMinutes: plannedMinutes(entry.startTime, entry.endTime),
          notes: entry.notes,
        })),
      })),
    };
  }
}
