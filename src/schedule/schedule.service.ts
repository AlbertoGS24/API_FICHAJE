import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import {
  ApplyScheduleTemplateDto,
  BulkUpsertScheduleEntriesDto,
  CopyScheduleMonthDto,
  MarkMySickLeaveDto,
  UpsertScheduleEntryDto,
  UpsertScheduleTemplateDto,
} from './dto/upsert-schedule-entry.dto';

const APP_TIMEZONE = 'Europe/Madrid';

function parseMonthRange(month?: string) {
  const normalized = (month ?? '').trim();
  const base = normalized
    ? DateTime.fromFormat(normalized, 'yyyy-LL', { zone: APP_TIMEZONE })
    : DateTime.now().setZone(APP_TIMEZONE);

  if (!base.isValid) {
    throw new BadRequestException('El mes debe tener formato YYYY-MM');
  }

  const start = base.startOf('month');
  const end = start.plus({ months: 1 });

  return {
    month: start.toFormat('yyyy-LL'),
    from: start.toUTC().toJSDate(),
    to: end.toUTC().toJSDate(),
  };
}

function parseScheduleDate(dateStr: string) {
  const parsed = DateTime.fromFormat(dateStr.trim(), 'yyyy-LL-dd', {
    zone: APP_TIMEZONE,
  }).startOf('day');

  if (!parsed.isValid) {
    throw new BadRequestException('La fecha debe tener formato YYYY-MM-DD');
  }

  return parsed;
}

function normalizeOptionalText(value?: string | null) {
  const text = value?.trim() ?? '';
  return text || null;
}

function normalizeWeekdays(values: number[]) {
  const normalized = [...new Set(values.map((value) => Number(value)))]
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7)
    .sort((a, b) => a - b);

  if (!normalized.length) {
    throw new BadRequestException(
      'Debes seleccionar al menos un día de la semana',
    );
  }

  return normalized;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToDurationLabel(minutes: number | null) {
  if (minutes == null) return null;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (!hours) return `${remainingMinutes} min`;
  if (!remainingMinutes) return `${hours} h`;
  return `${hours} h ${remainingMinutes} min`;
}

function formatMonthDay(date: DateTime, monthBase: DateTime) {
  const target = monthBase.set({ day: date.day }).startOf('day');
  if (!target.isValid || target.month !== monthBase.month) {
    return null;
  }
  return target;
}

function dateKeyFor(date: Date) {
  return DateTime.fromJSDate(date).setZone(APP_TIMEZONE).toFormat('yyyy-LL-dd');
}

function plannedMinutesFor(startTime: string | null, endTime: string | null) {
  if (!startTime || !endTime) return null;
  const minutes = timeToMinutes(endTime) - timeToMinutes(startTime);
  return minutes > 0 ? minutes : null;
}

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  private async ensureAdmin(firebaseUidAdmin: string) {
    const admin = await this.prisma.user.findUnique({
      where: { firebaseUid: firebaseUidAdmin },
      select: {
        id: true,
        role: true,
        companyId: true,
        email: true,
        name: true,
      },
    });

    if (!admin) throw new NotFoundException('Administrador no encontrado');
    if (admin.role !== 'ADMIN') {
      throw new BadRequestException('Acceso solo para administradores');
    }

    return admin;
  }

  private async ensureCompanyUser(companyId: string, userId: string) {
    const targetUser = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        workerGroup: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return targetUser;
  }

  private mapEntry(entry: {
    id: string;
    date: Date;
    type: string;
    startTime: string | null;
    endTime: string | null;
    notes: string | null;
  }) {
    const dateKey = DateTime.fromJSDate(entry.date)
      .setZone(APP_TIMEZONE)
      .toFormat('yyyy-LL-dd');
    const plannedMinutes = plannedMinutesFor(entry.startTime, entry.endTime);

    return {
      id: entry.id,
      date: entry.date,
      dateKey,
      type: entry.type,
      startTime: entry.startTime,
      endTime: entry.endTime,
      plannedStartTime: entry.startTime,
      plannedEndTime: entry.endTime,
      plannedMinutes,
      plannedDurationLabel: minutesToDurationLabel(plannedMinutes),
      notes: entry.notes,
    };
  }

  private async mergeCompanyHolidays(input: {
    companyId: string;
    from: Date;
    to: Date;
    entries: Array<{
      id: string;
      date: Date;
      type: string;
      startTime: string | null;
      endTime: string | null;
      notes: string | null;
    }>;
  }) {
    const holidays = await this.prisma.holiday.findMany({
      where: {
        companyId: input.companyId,
        date: {
          gte: input.from,
          lt: input.to,
        },
      },
      select: {
        id: true,
        date: true,
        name: true,
        notes: true,
      },
      orderBy: [{ date: 'asc' }, { name: 'asc' }],
    });

    const merged = [...input.entries];
    const indexByDate = new Map(
      merged.map((entry, index) => [dateKeyFor(entry.date), index]),
    );

    for (const holiday of holidays) {
      const dateKey = dateKeyFor(holiday.date);
      const existingIndex = indexByDate.get(dateKey);
      const holidayNotes = holiday.notes?.trim()
        ? `${holiday.name} · ${holiday.notes.trim()}`
        : holiday.name;

      if (existingIndex != null) {
        const existingEntry = merged[existingIndex];

        // Un festivo debe sustituir una jornada normal de trabajo, pero no
        // sobrescribir vacaciones, bajas o días libres ya aprobados.
        if (existingEntry.type === 'WORK' || existingEntry.type === 'HOLIDAY') {
          merged[existingIndex] = {
            ...existingEntry,
            id: `holiday-${holiday.id}`,
            type: 'HOLIDAY',
            startTime: null,
            endTime: null,
            notes: holidayNotes,
          };
        }
        continue;
      }

      merged.push({
        id: `holiday-${holiday.id}`,
        date: holiday.date,
        type: 'HOLIDAY',
        startTime: null,
        endTime: null,
        notes: holidayNotes,
      });
      indexByDate.set(dateKey, merged.length - 1);
    }

    return merged.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private mapTemplateEntry(entry: {
    id: string;
    weekday: number;
    type: string;
    startTime: string | null;
    endTime: string | null;
    notes: string | null;
  }) {
    const plannedMinutes = plannedMinutesFor(entry.startTime, entry.endTime);

    return {
      id: entry.id,
      weekday: entry.weekday,
      type: entry.type,
      startTime: entry.startTime,
      endTime: entry.endTime,
      plannedStartTime: entry.startTime,
      plannedEndTime: entry.endTime,
      plannedMinutes,
      plannedDurationLabel: minutesToDurationLabel(plannedMinutes),
      notes: entry.notes,
    };
  }

  private normalizePlannedTimes(input: {
    type: 'WORK' | 'VACATION' | 'SICK_LEAVE' | 'DAY_OFF' | 'HOLIDAY';
    startTime?: string;
    endTime?: string;
  }) {
    const startTime = normalizeOptionalText(input.startTime);
    const endTime = normalizeOptionalText(input.endTime);

    if (input.type !== 'WORK') {
      return { startTime: null, endTime: null };
    }

    if (!!startTime !== !!endTime) {
      throw new BadRequestException(
        'Debes indicar hora prevista de entrada y salida, o dejar ambas vacías',
      );
    }

    if (
      startTime &&
      endTime &&
      timeToMinutes(endTime) <= timeToMinutes(startTime)
    ) {
      throw new BadRequestException(
        'La hora prevista de salida debe ser posterior a la hora prevista de entrada',
      );
    }

    return { startTime, endTime };
  }

  private async upsertScheduleEntry(input: {
    userId: string;
    date: DateTime;
    type: 'WORK' | 'VACATION' | 'SICK_LEAVE' | 'DAY_OFF' | 'HOLIDAY';
    startTime?: string;
    endTime?: string;
    notes?: string | null;
  }) {
    const plannedTimes = this.normalizePlannedTimes({
      type: input.type,
      startTime: input.startTime,
      endTime: input.endTime,
    });

    return this.prisma.scheduleEntry.upsert({
      where: {
        userId_date: {
          userId: input.userId,
          date: input.date.toUTC().toJSDate(),
        },
      },
      update: {
        type: input.type,
        startTime: plannedTimes.startTime,
        endTime: plannedTimes.endTime,
        notes: normalizeOptionalText(input.notes),
      },
      create: {
        userId: input.userId,
        date: input.date.toUTC().toJSDate(),
        type: input.type,
        startTime: plannedTimes.startTime,
        endTime: plannedTimes.endTime,
        notes: normalizeOptionalText(input.notes),
      },
    });
  }

  async listMine(firebaseUid: string, month?: string) {
    const user = await this.usersService.findOrCreateByFirebaseUid(firebaseUid);
    const range = parseMonthRange(month);

    const entries = await this.prisma.scheduleEntry.findMany({
      where: {
        userId: user.id,
        date: { gte: range.from, lt: range.to },
      },
      orderBy: { date: 'asc' },
    });

    const mergedEntries = await this.mergeCompanyHolidays({
      companyId: user.companyId,
      from: range.from,
      to: range.to,
      entries,
    });

    return {
      month: range.month,
      entries: mergedEntries.map((entry) => this.mapEntry(entry)),
    };
  }

  async markMySickLeave(firebaseUid: string, dto: MarkMySickLeaveDto) {
    const user = await this.usersService.findOrCreateByFirebaseUid(firebaseUid);
    const fromDate = parseScheduleDate(dto.fromDate);
    const toDate = parseScheduleDate(dto.toDate);

    if (toDate < fromDate) {
      throw new BadRequestException(
        'La fecha final debe ser igual o posterior a la inicial',
      );
    }

    if (toDate.diff(fromDate, 'days').days > 90) {
      throw new BadRequestException(
        'La baja médica directa no puede superar 90 días desde esta pantalla',
      );
    }

    const fromDateJs = new Date(`${dto.fromDate}T00:00:00.000Z`);
    const toDateJs = new Date(`${dto.toDate}T00:00:00.000Z`);

    await this.syncRangeByType(
      user.id,
      fromDateJs,
      toDateJs,
      'SICK_LEAVE',
      dto.notes,
    );

    return {
      ok: true,
      fromDate: fromDate.toFormat('yyyy-LL-dd'),
      toDate: toDate.toFormat('yyyy-LL-dd'),
      type: 'SICK_LEAVE',
    };
  }

  async listForAdmin(firebaseUidAdmin: string, userId: string, month?: string) {
    const admin = await this.ensureAdmin(firebaseUidAdmin);
    const range = parseMonthRange(month);
    const targetUser = await this.ensureCompanyUser(admin.companyId, userId);

    const entries = await this.prisma.scheduleEntry.findMany({
      where: {
        userId: targetUser.id,
        date: { gte: range.from, lt: range.to },
      },
      orderBy: { date: 'asc' },
    });

    const mergedEntries = await this.mergeCompanyHolidays({
      companyId: admin.companyId,
      from: range.from,
      to: range.to,
      entries,
    });

    return {
      month: range.month,
      user: targetUser,
      entries: mergedEntries.map((entry) => this.mapEntry(entry)),
    };
  }

  async upsertForAdmin(firebaseUidAdmin: string, dto: UpsertScheduleEntryDto) {
    const admin = await this.ensureAdmin(firebaseUidAdmin);
    const targetUser = await this.ensureCompanyUser(
      admin.companyId,
      dto.userId,
    );

    const date = parseScheduleDate(dto.date);
    const entry = await this.upsertScheduleEntry({
      userId: targetUser.id,
      date,
      type: dto.type,
      startTime: dto.startTime,
      endTime: dto.endTime,
      notes: dto.notes,
    });

    return this.mapEntry(entry);
  }

  async bulkUpsertForAdmin(
    firebaseUidAdmin: string,
    dto: BulkUpsertScheduleEntriesDto,
  ) {
    const admin = await this.ensureAdmin(firebaseUidAdmin);
    const targetUser = await this.ensureCompanyUser(
      admin.companyId,
      dto.userId,
    );
    const fromDate = parseScheduleDate(dto.fromDate);
    const toDate = parseScheduleDate(dto.toDate);
    const weekdays = normalizeWeekdays(dto.weekdays);

    if (toDate < fromDate) {
      throw new BadRequestException(
        'La fecha final debe ser igual o posterior a la inicial',
      );
    }

    if (toDate.diff(fromDate, 'days').days > 370) {
      throw new BadRequestException('El rango máximo permitido es de 12 meses');
    }

    let affected = 0;
    let cursor = fromDate;

    while (cursor <= toDate) {
      const weekday = Number(cursor.weekday);
      if (!Number.isInteger(weekday)) {
        cursor = cursor.plus({ days: 1 });
        continue;
      }

      if (weekdays.includes(weekday)) {
        await this.upsertScheduleEntry({
          userId: targetUser.id,
          date: cursor,
          type: dto.type,
          startTime: dto.startTime,
          endTime: dto.endTime,
          notes: dto.notes,
        });
        affected += 1;
      }

      cursor = cursor.plus({ days: 1 });
    }

    if (!affected) {
      throw new BadRequestException(
        'No hay días dentro del rango que coincidan con el patrón seleccionado',
      );
    }

    return {
      ok: true,
      affected,
      user: targetUser,
      fromDate: fromDate.toFormat('yyyy-LL-dd'),
      toDate: toDate.toFormat('yyyy-LL-dd'),
      weekdays,
    };
  }

  async listTemplateForAdmin(firebaseUidAdmin: string, userId: string) {
    const admin = await this.ensureAdmin(firebaseUidAdmin);
    const targetUser = await this.ensureCompanyUser(admin.companyId, userId);

    const entries = await this.prisma.scheduleTemplateEntry.findMany({
      where: { userId: targetUser.id },
      orderBy: { weekday: 'asc' },
    });

    return {
      user: targetUser,
      entries: entries.map((entry) => this.mapTemplateEntry(entry)),
    };
  }

  async saveTemplateForAdmin(
    firebaseUidAdmin: string,
    dto: UpsertScheduleTemplateDto,
  ) {
    const admin = await this.ensureAdmin(firebaseUidAdmin);
    const targetUser = await this.ensureCompanyUser(
      admin.companyId,
      dto.userId,
    );
    const weekdays = normalizeWeekdays(dto.weekdays);

    const plannedTimes = this.normalizePlannedTimes({
      type: dto.type,
      startTime: dto.startTime,
      endTime: dto.endTime,
    });

    for (const weekday of weekdays) {
      await this.prisma.scheduleTemplateEntry.upsert({
        where: {
          userId_weekday: {
            userId: targetUser.id,
            weekday,
          },
        },
        update: {
          type: dto.type,
          startTime: plannedTimes.startTime,
          endTime: plannedTimes.endTime,
          notes: normalizeOptionalText(dto.notes),
        },
        create: {
          userId: targetUser.id,
          weekday,
          type: dto.type,
          startTime: plannedTimes.startTime,
          endTime: plannedTimes.endTime,
          notes: normalizeOptionalText(dto.notes),
        },
      });
    }

    return this.listTemplateForAdmin(firebaseUidAdmin, targetUser.id);
  }

  async applyTemplateForAdmin(
    firebaseUidAdmin: string,
    dto: ApplyScheduleTemplateDto,
  ) {
    const admin = await this.ensureAdmin(firebaseUidAdmin);
    const targetUser = await this.ensureCompanyUser(
      admin.companyId,
      dto.userId,
    );
    const range = parseMonthRange(dto.month);

    const templateEntries = await this.prisma.scheduleTemplateEntry.findMany({
      where: { userId: targetUser.id },
      orderBy: { weekday: 'asc' },
    });

    if (!templateEntries.length) {
      throw new BadRequestException(
        'Este usuario no tiene plantilla semanal guardada',
      );
    }

    const templateByWeekday = new Map(
      templateEntries.map((entry) => [entry.weekday, entry]),
    );

    let affected = 0;
    let cursor = DateTime.fromJSDate(range.from).setZone(APP_TIMEZONE);
    const end = DateTime.fromJSDate(range.to).setZone(APP_TIMEZONE);

    while (cursor < end) {
      const weekday = Number(cursor.weekday);
      const template = Number.isInteger(weekday)
        ? templateByWeekday.get(weekday)
        : undefined;
      if (template) {
        await this.upsertScheduleEntry({
          userId: targetUser.id,
          date: cursor,
          type: template.type,
          startTime: template.startTime ?? undefined,
          endTime: template.endTime ?? undefined,
          notes: template.notes,
        });
        affected += 1;
      }
      cursor = cursor.plus({ days: 1 });
    }

    return {
      ok: true,
      affected,
      month: range.month,
      user: targetUser,
      templateEntries: templateEntries.map((entry) =>
        this.mapTemplateEntry(entry),
      ),
    };
  }

  async copyMonthForAdmin(firebaseUidAdmin: string, dto: CopyScheduleMonthDto) {
    const admin = await this.ensureAdmin(firebaseUidAdmin);
    const targetUser = await this.ensureCompanyUser(
      admin.companyId,
      dto.userId,
    );
    const sourceRange = parseMonthRange(dto.sourceMonth);
    const targetRange = parseMonthRange(dto.targetMonth);

    if (sourceRange.month === targetRange.month) {
      throw new BadRequestException(
        'El mes origen y el mes destino no pueden ser el mismo',
      );
    }

    const sourceEntries = await this.prisma.scheduleEntry.findMany({
      where: {
        userId: targetUser.id,
        date: { gte: sourceRange.from, lt: sourceRange.to },
      },
      orderBy: { date: 'asc' },
    });

    if (!sourceEntries.length) {
      throw new BadRequestException(
        'El mes origen no tiene entradas de cuadrante para copiar',
      );
    }

    const targetMonthBase = DateTime.fromJSDate(targetRange.from).setZone(
      APP_TIMEZONE,
    );

    let copied = 0;
    let skipped = 0;

    for (const sourceEntry of sourceEntries) {
      const sourceDate = DateTime.fromJSDate(sourceEntry.date).setZone(
        APP_TIMEZONE,
      );
      const targetDate = formatMonthDay(sourceDate, targetMonthBase);

      if (!targetDate) {
        skipped += 1;
        continue;
      }

      await this.upsertScheduleEntry({
        userId: targetUser.id,
        date: targetDate,
        type: sourceEntry.type,
        startTime: sourceEntry.startTime ?? undefined,
        endTime: sourceEntry.endTime ?? undefined,
        notes: sourceEntry.notes,
      });
      copied += 1;
    }

    return {
      ok: true,
      copied,
      skipped,
      sourceMonth: sourceRange.month,
      targetMonth: targetRange.month,
      user: targetUser,
    };
  }

  async deleteForAdmin(
    firebaseUidAdmin: string,
    userId: string,
    dateStr: string,
  ) {
    const admin = await this.ensureAdmin(firebaseUidAdmin);
    const date = parseScheduleDate(dateStr);
    const targetUser = await this.ensureCompanyUser(admin.companyId, userId);

    const deleted = await this.prisma.scheduleEntry.deleteMany({
      where: {
        userId: targetUser.id,
        date: date.toUTC().toJSDate(),
      },
    });

    if (!deleted.count) {
      throw new NotFoundException('No existe ninguna entrada para ese día');
    }

    return { ok: true, deleted: deleted.count };
  }

  async syncVacationRange(
    userId: string,
    startAt: Date,
    endAt: Date,
    notes?: string | null,
  ) {
    return this.syncRangeByType(userId, startAt, endAt, 'VACATION', notes);
  }

  async syncRangeByType(
    userId: string,
    startAt: Date,
    endAt: Date,
    type: 'VACATION' | 'SICK_LEAVE' | 'DAY_OFF',
    notes?: string | null,
  ) {
    const start = DateTime.fromJSDate(startAt)
      .setZone(APP_TIMEZONE)
      .startOf('day');
    const end = DateTime.fromJSDate(endAt).setZone(APP_TIMEZONE).startOf('day');
    const safeNotes = normalizeOptionalText(notes);

    if (!start.isValid || !end.isValid) return;
    if (end < start) return;

    let cursor = start;
    while (cursor <= end) {
      await this.upsertScheduleEntry({
        userId,
        date: cursor,
        type,
        notes: safeNotes,
      });

      cursor = cursor.plus({ days: 1 });
    }
  }
}
