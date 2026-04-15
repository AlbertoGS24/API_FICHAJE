import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DateTime } from 'luxon';
import { UsersService } from '../users/users.service';
import { calculateExpectedWorkMinutes } from '../shared/work-metrics';

function parseDateOnly(dateStr: string): Date {
  // Espera YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m)
    throw new BadRequestException('Formato de fecha inválido. Usa YYYY-MM-DD');

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  // Creamos fecha en UTC a medianoche para evitar líos de zona horaria
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

function addDaysUTC(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  private async getUserByFirebaseUid(firebaseUid: string) {
    return this.usersService.findOrCreateByFirebaseUid(firebaseUid);
  }

  async weekly(firebaseUid: string, from: string, to: string) {
    const fromDate = parseDateOnly(from);
    const toDate = parseDateOnly(to);

    if (toDate < fromDate) {
      throw new BadRequestException('"to" debe ser posterior o igual a "from"');
    }

    // Incluimos el día "to" completo: [from, to+1día)
    const toExclusive = addDaysUTC(toDate, 1);

    const user = await this.getUserByFirebaseUid(firebaseUid);
    const userId = user.id;

    // Turnos cerrados dentro del rango
    const shifts = await this.prisma.shift.findMany({
      where: {
        userId,
        startAt: { gte: fromDate, lt: toExclusive },
        endAt: { not: null },
      },
      orderBy: { startAt: 'asc' },
    });

    // Agrupación por día (YYYY-MM-DD)
    const byDay = new Map<string, { minutes: number; shifts: any[] }>();

    let totalMinutes = 0;

    for (const s of shifts) {
      const start = new Date(s.startAt);
      const end = new Date(s.endAt!);
      const minutes = Math.max(
        0,
        Math.round((end.getTime() - start.getTime()) / 60000),
      );

      totalMinutes += minutes;

      const key = String(
        DateTime.fromJSDate(s.startAt)
          .setZone('Europe/Madrid')
          .toFormat('yyyy-LL-dd'),
      ); // YYYY-MM-DD
      const current = byDay.get(key) ?? { minutes: 0, shifts: [] };
      current.minutes += minutes;

      const startMadrid = DateTime.fromJSDate(s.startAt)
        .setZone('Europe/Madrid')
        .toISO();
      const endMadrid = DateTime.fromJSDate(s.endAt!)
        .setZone('Europe/Madrid')
        .toISO();

      current.shifts.push({
        id: s.id,
        startAt: startMadrid,
        endAt: endMadrid,
        minutes,
      });
      byDay.set(key, current);
    }

    const days = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, info]) => ({
        date,
        minutes: info.minutes,
        hours: Number((info.minutes / 60).toFixed(2)),
        shifts: info.shifts,
      }));

    const expectedByUser = await calculateExpectedWorkMinutes({
      prisma: this.prisma,
      companyId: user.companyId,
      userIds: [userId],
      from: fromDate,
      toExclusive,
    });
    const expectedMinutes = expectedByUser.get(userId) ?? 0;

    return {
      from,
      to,
      totalMinutes,
      totalHours: Number((totalMinutes / 60).toFixed(2)),
      expectedMinutes,
      expectedHours: Number((expectedMinutes / 60).toFixed(2)),
      balanceHours: Number(((totalMinutes - expectedMinutes) / 60).toFixed(2)),
      days,
    };
  }

  async monthly(firebaseUid: string, yearStr: string, monthStr: string) {
    const year = Number(yearStr);
    const month = Number(monthStr);

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('year inválido');
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('month inválido (1-12)');
    }

    // Rango del mes en UTC: [primer día, primer día del mes siguiente)
    const fromDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const toDateExclusive = new Date(Date.UTC(year, month, 1, 0, 0, 0));

    // Convertimos a YYYY-MM-DD para reutilizar weekly()
    const from = fromDate.toISOString().slice(0, 10);
    const toInclusive = new Date(toDateExclusive);
    toInclusive.setUTCDate(toInclusive.getUTCDate() - 1);
    const to = toInclusive.toISOString().slice(0, 10);

    const result = await this.weekly(firebaseUid, from, to);

    return {
      ...result,
      year,
      month,
    };
  }
}
