/**
 * Servicio para gestionar los fichajes de los usuarios.
 * Permite fichar entrada, fichar salida y consultar el estado actual.
 * Nota: Este servicio utiliza una simulación de base de datos en memoria,
 * lo cual es adecuado para desarrollo pero no para producción. En un entorno
 * real, se debería integrar con una base de datos persistente.
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClockLocationDto } from './dto/clock-location.dto';
import { UsersService } from '../users/users.service';

function minutesBetween(startAt: Date, endAt: Date | null): number {
  if (!endAt) return 0;
  const diffMs = new Date(endAt).getTime() - new Date(startAt).getTime();
  return diffMs > 0 ? Math.ceil(diffMs / 60000) : 0;
}

function startOfIsoWeekUTC(base = new Date()): Date {
  const d = new Date(base);
  const day = d.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - offset);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

type ShiftRequestContext = {
  ip?: string | null;
  userAgent?: string | null;
};

type NormalizedLocation = {
  lat: number;
  lng: number;
  accuracy: number | null;
};

type WorkplaceSnapshot = {
  id: string;
  name: string | null;
  addressLabel: string | null;
  municipality: string | null;
  province: string | null;
  region: string | null;
  country: string | null;
  lat: number;
  lng: number;
  radiusMeters: number;
  strictMode: boolean;
  maxAllowedAccuracy: number | null;
  isPrimary: boolean;
};

type RiskEvaluation = {
  score: number;
  reasons: string[];
  distanceMeters: number | null;
  isInsideGeofence: boolean | null;
};

function parsePositiveNumberEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

const GEO_DEFAULT_MAX_ALLOWED_ACCURACY = parsePositiveNumberEnv(
  'GEO_DEFAULT_MAX_ALLOWED_ACCURACY',
  80,
);
const GEO_SUSPICIOUS_SCORE_THRESHOLD = Math.round(
  parsePositiveNumberEnv('GEO_SUSPICIOUS_SCORE_THRESHOLD', 50),
);
const GEO_REVERSE_GEOCODE_URL =
  process.env.GEO_REVERSE_GEOCODE_URL?.trim() ||
  'https://nominatim.openstreetmap.org/reverse';

function parseBooleanEnv(name: string, fallback: boolean) {
  const raw = process.env[name]?.trim().toLowerCase() ?? '';
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw)
    ? true
    : ['0', 'false', 'no', 'off'].includes(raw)
      ? false
      : fallback;
}

const GEO_REVERSE_GEOCODE_ENABLED = parseBooleanEnv(
  'GEO_REVERSE_GEOCODE_ENABLED',
  true,
);

function toRounded(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const earthRadiusM = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeIp(ip?: string | null) {
  const value = (ip ?? '').trim();
  if (!value) return null;
  return value.slice(0, 120);
}

function normalizeUserAgent(userAgent?: string | null) {
  const value = (userAgent ?? '').trim();
  if (!value) return null;
  return value.slice(0, 512);
}

function parseRiskReasons(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function uniqueReasons(reasons: string[]) {
  return Array.from(new Set(reasons));
}

function formatLatLng(value: number) {
  return value.toFixed(6);
}

@Injectable()
export class ShiftsService {
  private readonly logger = new Logger(ShiftsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  private async ensureUser(firebaseUid: string) {
    return this.usersService.findOrCreateByFirebaseUid(firebaseUid);
  }

  private async ensureUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        companyId: true,
      },
    });
    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }
    return user;
  }

  private async ensureUserId(firebaseUid: string) {
    const user = await this.ensureUser(firebaseUid);
    return user.id;
  }

  private async getActiveWorkplaces(
    companyId: string,
  ): Promise<WorkplaceSnapshot[]> {
    return this.prisma.workplace.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        addressLabel: true,
        municipality: true,
        province: true,
        region: true,
        country: true,
        lat: true,
        lng: true,
        radiusMeters: true,
        strictMode: true,
        maxAllowedAccuracy: true,
        isPrimary: true,
      },
    });
  }

  private async getWorkplaceById(
    companyId: string,
    workplaceId: string,
  ): Promise<WorkplaceSnapshot | null> {
    return this.prisma.workplace.findFirst({
      where: { id: workplaceId, companyId },
      select: {
        id: true,
        name: true,
        addressLabel: true,
        municipality: true,
        province: true,
        region: true,
        country: true,
        lat: true,
        lng: true,
        radiusMeters: true,
        strictMode: true,
        maxAllowedAccuracy: true,
        isPrimary: true,
      },
    });
  }

  private async resolveWorkplace(params: {
    companyId: string;
    location: NormalizedLocation | null;
    requestedWorkplaceId?: string;
  }): Promise<WorkplaceSnapshot | null> {
    if (params.requestedWorkplaceId) {
      const requested = await this.getWorkplaceById(
        params.companyId,
        params.requestedWorkplaceId,
      );
      if (requested?.id) return requested;
    }

    const workplaces = await this.getActiveWorkplaces(params.companyId);
    if (!workplaces.length) return null;

    if (!params.location) {
      return (
        workplaces.find((workplace) => workplace.isPrimary) ?? workplaces[0]
      );
    }

    let nearest = workplaces[0];
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const workplace of workplaces) {
      const distance = haversineDistanceMeters(
        params.location.lat,
        params.location.lng,
        workplace.lat,
        workplace.lng,
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = workplace;
      }
    }

    return nearest;
  }

  private async reverseGeocode(
    location: NormalizedLocation | null,
  ): Promise<string | null> {
    if (!location) return null;
    if (!GEO_REVERSE_GEOCODE_ENABLED) {
      return `Lat ${formatLatLng(location.lat)}, Lng ${formatLatLng(location.lng)}`;
    }

    try {
      const url = new URL(GEO_REVERSE_GEOCODE_URL);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('lat', String(location.lat));
      url.searchParams.set('lon', String(location.lng));
      url.searchParams.set('zoom', '18');
      url.searchParams.set('addressdetails', '1');

      const response = await fetch(url.toString(), {
        headers: {
          accept: 'application/json',
          'user-agent': 'api-fichar/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Reverse geocode ${response.status}`);
      }

      const payload = (await response.json()) as {
        display_name?: string;
        address?: Record<string, string>;
      };
      const displayName = String(payload.display_name ?? '').trim();
      if (displayName) {
        return displayName.slice(0, 240);
      }

      const address = payload.address ?? {};
      const parts = [
        address.road,
        address.house_number,
        address.city ?? address.town ?? address.village ?? address.municipality,
        address.state,
        address.country,
      ].filter(Boolean);

      return parts.length
        ? parts.join(', ').slice(0, 240)
        : `Lat ${formatLatLng(location.lat)}, Lng ${formatLatLng(location.lng)}`;
    } catch (error) {
      this.logger.warn(
        `No se pudo resolver la dirección del fichaje: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return `Lat ${formatLatLng(location.lat)}, Lng ${formatLatLng(location.lng)}`;
    }
  }

  private evaluateGeofenceRisk(
    location: NormalizedLocation | null,
    workplace: WorkplaceSnapshot | null,
    stage: 'START' | 'END',
  ): RiskEvaluation {
    const result: RiskEvaluation = {
      score: 0,
      reasons: [],
      distanceMeters: null,
      isInsideGeofence: null,
    };

    if (!location) {
      result.score += stage === 'START' ? 35 : 25;
      result.reasons.push(`NO_LOCATION_${stage}`);
      return result;
    }

    const maxAllowedAccuracy =
      workplace?.maxAllowedAccuracy ?? GEO_DEFAULT_MAX_ALLOWED_ACCURACY;
    if (
      location.accuracy != null &&
      Number.isFinite(location.accuracy) &&
      location.accuracy > maxAllowedAccuracy
    ) {
      result.score += 20;
      result.reasons.push(`LOW_ACCURACY_${stage}`);
    }

    if (!workplace) {
      result.reasons.push('WORKPLACE_NOT_CONFIGURED');
      return result;
    }

    const distance = haversineDistanceMeters(
      location.lat,
      location.lng,
      workplace.lat,
      workplace.lng,
    );
    const roundedDistance = toRounded(distance, 1);
    result.distanceMeters = roundedDistance;
    result.isInsideGeofence = distance <= workplace.radiusMeters;

    if (result.isInsideGeofence === false) {
      const overflow = distance - workplace.radiusMeters;
      if (overflow > 1000) result.score += 60;
      else if (overflow > 300) result.score += 45;
      else result.score += 30;
      result.reasons.push(`OUTSIDE_GEOFENCE_${stage}`);
    }

    return result;
  }

  private evaluateMovementRisk(params: {
    startLat: number | null;
    startLng: number | null;
    endLat: number | null;
    endLng: number | null;
    startAt: Date;
    endAt: Date;
  }) {
    let score = 0;
    const reasons: string[] = [];

    if (
      params.startLat == null ||
      params.startLng == null ||
      params.endLat == null ||
      params.endLng == null
    ) {
      return { score, reasons };
    }

    const distanceMeters = haversineDistanceMeters(
      params.startLat,
      params.startLng,
      params.endLat,
      params.endLng,
    );
    const elapsedHours = Math.max(
      1 / 3600, // 1 segundo
      (params.endAt.getTime() - params.startAt.getTime()) / 3600000,
    );
    const speedKmh = distanceMeters / 1000 / elapsedHours;

    if (speedKmh > 220) {
      score += 45;
      reasons.push('IMPOSSIBLE_SPEED');
    } else if (speedKmh > 140) {
      score += 25;
      reasons.push('UNUSUAL_SPEED');
    }

    if (distanceMeters > 5000 && elapsedHours < 0.12) {
      score += 30;
      reasons.push('LARGE_JUMP_IN_SHORT_TIME');
    }

    return { score, reasons };
  }

  async getOpenShift(firebaseUid: string) {
    const userId = await this.ensureUserId(firebaseUid);
    return this.getOpenShiftByUserId(userId);
  }

  async getOpenShiftByUserId(userId: string) {
    return this.prisma.shift.findFirst({
      where: { userId, endAt: null },
      orderBy: { startAt: 'desc' },
    });
  }

  async status(firebaseUid: string) {
    const open = await this.getOpenShift(firebaseUid);
    return {
      hasOpenShift: !!open,
      openShift: open,
    };
  }

  async mine(firebaseUid: string, limitRaw?: string) {
    const userId = await this.ensureUserId(firebaseUid);
    const parsedLimit = Number(limitRaw ?? '10');
    const take = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 50)
      : 10;

    const shifts = await this.prisma.shift.findMany({
      where: { userId },
      orderBy: { startAt: 'desc' },
      take,
      select: {
        id: true,
        startAt: true,
        endAt: true,
        startLat: true,
        startLng: true,
        startAddress: true,
        endLat: true,
        endLng: true,
        endAddress: true,
        createdAt: true,
        workplace: {
          select: {
            id: true,
            name: true,
            addressLabel: true,
          },
        },
      },
    });

    return shifts.map((shift) => {
      const workedMinutes = minutesBetween(shift.startAt, shift.endAt);
      return {
        id: shift.id,
        startAt: shift.startAt,
        endAt: shift.endAt,
        startLat: shift.startLat,
        startLng: shift.startLng,
        startAddress: shift.startAddress,
        endLat: shift.endLat,
        endLng: shift.endLng,
        endAddress: shift.endAddress,
        workplace: shift.workplace,
        createdAt: shift.createdAt,
        isOpen: shift.endAt == null,
        workedMinutes,
        workedHours: Number((workedMinutes / 60).toFixed(2)),
      };
    });
  }

  private normalizeLocation(dto?: ClockLocationDto) {
    if (!dto) return null;
    const hasLat = typeof dto.lat === 'number';
    const hasLng = typeof dto.lng === 'number';
    if (hasLat !== hasLng) {
      throw new BadRequestException('Debes enviar lat y lng juntos');
    }
    if (!hasLat || !hasLng) return null;
    return {
      lat: dto.lat!,
      lng: dto.lng!,
      accuracy: typeof dto.accuracy === 'number' ? dto.accuracy : null,
    };
  }

  async clockIn(
    firebaseUid: string,
    dto?: ClockLocationDto,
    context?: ShiftRequestContext,
  ) {
    const user = await this.ensureUser(firebaseUid);
    return this.clockInByUserId(user.id, dto, context, user.companyId);
  }

  async clockInByUserId(
    userId: string,
    dto?: ClockLocationDto,
    context?: ShiftRequestContext,
    companyIdOverride?: string,
  ) {
    const user =
      companyIdOverride != null
        ? { id: userId, companyId: companyIdOverride }
        : await this.ensureUserById(userId);

    // comprobar si ya hay abierto
    const open = await this.prisma.shift.findFirst({
      where: { userId, endAt: null },
    });
    if (open) throw new BadRequestException('Ya existe un fichaje abierto.');

    const location = this.normalizeLocation(dto);
    const workplace = await this.resolveWorkplace({
      companyId: user.companyId,
      location,
      requestedWorkplaceId: dto?.workplaceId,
    });
    const startRisk = this.evaluateGeofenceRisk(location, workplace, 'START');
    const riskReasons = uniqueReasons(startRisk.reasons);
    const riskScore = startRisk.score;
    const isSuspicious = riskScore >= GEO_SUSPICIOUS_SCORE_THRESHOLD;

    if (workplace?.strictMode && startRisk.isInsideGeofence === false) {
      throw new BadRequestException(
        'Fichaje fuera de la zona de trabajo permitida',
      );
    }

    const now = new Date();
    const startAddress = await this.reverseGeocode(location);
    const shift = await this.prisma.shift.create({
      data: {
        userId,
        workplaceId: workplace?.id ?? null,
        startAt: now,
        startLat: location?.lat ?? null,
        startLng: location?.lng ?? null,
        startAddress,
        accuracy: location?.accuracy ?? null,
        startDistanceMeters: startRisk.distanceMeters,
        startInsideGeofence: startRisk.isInsideGeofence,
        riskScore,
        riskReasons: riskReasons,
        isSuspicious,
        startIp: normalizeIp(context?.ip),
        startUserAgent: normalizeUserAgent(context?.userAgent),
      },
    });

    return shift;
  }
  async clockOut(
    firebaseUid: string,
    dto?: ClockLocationDto,
    context?: ShiftRequestContext,
  ) {
    const user = await this.ensureUser(firebaseUid);
    return this.clockOutByUserId(user.id, dto, context, user.companyId);
  }

  async clockOutByUserId(
    userId: string,
    dto?: ClockLocationDto,
    context?: ShiftRequestContext,
    companyIdOverride?: string,
  ) {
    const user =
      companyIdOverride != null
        ? { id: userId, companyId: companyIdOverride }
        : await this.ensureUserById(userId);

    const open = await this.prisma.shift.findFirst({
      where: { userId, endAt: null },
      select: {
        id: true,
        startAt: true,
        startLat: true,
        startLng: true,
        workplaceId: true,
        accuracy: true,
        riskScore: true,
        riskReasons: true,
      },
    });
    if (!open) throw new BadRequestException('No hay fichaje abierto.');

    const location = this.normalizeLocation(dto);
    const workplace =
      (open.workplaceId
        ? await this.getWorkplaceById(user.companyId, open.workplaceId)
        : null) ??
      (await this.resolveWorkplace({
        companyId: user.companyId,
        location,
        requestedWorkplaceId: dto?.workplaceId,
      }));
    const endRisk = this.evaluateGeofenceRisk(location, workplace, 'END');
    const now = new Date();
    if (workplace?.strictMode && endRisk.isInsideGeofence === false) {
      endRisk.score += 20;
      endRisk.reasons.push('STRICT_MODE_END_OUTSIDE');
    }

    const movementRisk = this.evaluateMovementRisk({
      startLat: open.startLat,
      startLng: open.startLng,
      endLat: location?.lat ?? null,
      endLng: location?.lng ?? null,
      startAt: open.startAt,
      endAt: now,
    });

    const priorReasons = parseRiskReasons(open.riskReasons);
    const riskReasons = uniqueReasons([
      ...priorReasons,
      ...endRisk.reasons,
      ...movementRisk.reasons,
    ]);
    const riskScore = Math.max(
      0,
      (open.riskScore ?? 0) + endRisk.score + movementRisk.score,
    );
    const isSuspicious = riskScore >= GEO_SUSPICIOUS_SCORE_THRESHOLD;

    const endAddress = await this.reverseGeocode(location);
    const updated = await this.prisma.shift.update({
      where: { id: open.id },
      data: {
        endAt: now,
        endLat: location?.lat ?? null,
        endLng: location?.lng ?? null,
        endAddress,
        accuracy: location?.accuracy ?? open.accuracy ?? null,
        endDistanceMeters: endRisk.distanceMeters,
        endInsideGeofence: endRisk.isInsideGeofence,
        riskScore,
        riskReasons: riskReasons,
        isSuspicious,
        endIp: normalizeIp(context?.ip),
        endUserAgent: normalizeUserAgent(context?.userAgent),
      },
    });

    await this.handleWeeklyOvertimeAfterClockOut(userId, updated.id);

    return updated;
  }

  private async handleWeeklyOvertimeAfterClockOut(
    userId: string,
    shiftId: string,
  ) {
    const [user, closedShift] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          workerGroup: true,
          companyId: true,
        },
      }),
      this.prisma.shift.findUnique({
        where: { id: shiftId },
        select: {
          id: true,
          startAt: true,
          endAt: true,
        },
      }),
    ]);

    if (!user || !closedShift || !closedShift.endAt) return;
    if (user.workerGroup !== 'EMPLOYEE') return;

    const weekStart = startOfIsoWeekUTC(closedShift.endAt);
    const closedShifts = await this.prisma.shift.findMany({
      where: {
        userId,
        startAt: { gte: weekStart },
        endAt: { not: null },
      },
      select: { id: true, startAt: true, endAt: true },
      orderBy: { startAt: 'asc' },
    });

    const weeklyMinutesAfter = closedShifts.reduce(
      (acc, s) => acc + minutesBetween(s.startAt, s.endAt),
      0,
    );

    const currentShiftMinutes = minutesBetween(
      closedShift.startAt,
      closedShift.endAt,
    );
    const weeklyMinutesBefore = Math.max(
      0,
      weeklyMinutesAfter - currentShiftMinutes,
    );

    const limitHours = Number(process.env.WEEKLY_LIMIT_HOURS ?? '40');
    const limitMinutes = Math.max(0, Math.round(limitHours * 60));

    const exceededBefore = Math.max(0, weeklyMinutesBefore - limitMinutes);
    const exceededAfter = Math.max(0, weeklyMinutesAfter - limitMinutes);
    const newExceededMinutes = Math.max(0, exceededAfter - exceededBefore);

    if (newExceededMinutes <= 0) return;

    const overtimeStart = new Date(
      closedShift.endAt.getTime() - newExceededMinutes * 60 * 1000,
    );

    const overtimeRequest = await this.prisma.request.create({
      data: {
        userId,
        type: 'OVERTIME',
        status: 'PENDING',
        source: 'EMPLOYEE',
        startAt: overtimeStart,
        endAt: closedShift.endAt,
        comment: `Detección automática: ${(newExceededMinutes / 60).toFixed(
          2,
        )}h extra por superar límite semanal de ${limitHours}h.`,
      },
      select: { id: true },
    });

    const weekKey = weekStart.toISOString().slice(0, 10);

    await this.prisma.notification.upsert({
      where: {
        userId_type_scopeKey: {
          userId,
          type: 'WEEKLY_LIMIT_EXCEEDED',
          scopeKey: `WEEK_${weekKey}`,
        },
      },
      update: {},
      create: {
        userId,
        type: 'WEEKLY_LIMIT_EXCEEDED',
        scopeKey: `WEEK_${weekKey}`,
        message: `Has superado el límite semanal (${limitHours}h). Se ha generado una solicitud de horas extra pendiente de aprobación.`,
        meta: {
          requestId: overtimeRequest.id,
          weekStart,
          weeklyLimitHours: limitHours,
          exceededMinutesAfter: exceededAfter,
        },
      },
    });

    const admins = await this.prisma.user.findMany({
      where: {
        role: 'ADMIN',
        companyId: user.companyId,
      },
      select: { id: true },
    });

    for (const admin of admins) {
      await this.prisma.notification.upsert({
        where: {
          userId_type_scopeKey: {
            userId: admin.id,
            type: 'OVERTIME_PENDING_APPROVAL',
            scopeKey: `OT_${userId}_${weekKey}`,
          },
        },
        update: {},
        create: {
          userId: admin.id,
          type: 'OVERTIME_PENDING_APPROVAL',
          scopeKey: `OT_${userId}_${weekKey}`,
          message: `Horas extra pendientes de aprobación para ${
            user.name || user.email || user.id
          }.`,
          meta: {
            employeeUserId: userId,
            requestId: overtimeRequest.id,
            weekStart,
            exceededMinutes: newExceededMinutes,
            weeklyLimitHours: limitHours,
          },
        },
      });
    }
  }
}
