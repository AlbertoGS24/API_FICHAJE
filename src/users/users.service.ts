import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getFirebaseAdminApp } from '../auth/firebase-admin';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import {
  calculateExpectedWorkMinutes,
  calculateOvertimeMinutes,
  calculateVacationDayUsage,
} from '../shared/work-metrics';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

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

const userProfileSelect = {
  id: true,
  companyId: true,
  firebaseUid: true,
  email: true,
  name: true,
  phone: true,
  birthDate: true,
  role: true,
  workerGroup: true,
  internshipTotalHours: true,
  vacationAllowanceDays: true,
  overtimeBankMinutesAdjustment: true,
  createdAt: true,
} as const satisfies Prisma.UserSelect;

function hasFirebaseErrorCode(error: unknown, code: string): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: string }).code === code;
}

function normalizeOptionalText(value: string | undefined) {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeNullableText(value: string | null) {
  if (value == null) return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function parseBooleanEnv(name: string, fallback: boolean) {
  const raw = process.env[name]?.trim().toLowerCase() ?? '';
  if (!raw) return fallback;
  if (TRUE_VALUES.has(raw)) return true;
  if (FALSE_VALUES.has(raw)) return false;
  return fallback;
}

function parseBirthDate(dateInput: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.trim());
  if (!m) {
    throw new BadRequestException(
      'Fecha de nacimiento inválida. Usa formato YYYY-MM-DD',
    );
  }

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Fecha de nacimiento inválida');
  }

  return parsed;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private isDefaultCompanyBootstrapEnabled() {
    return parseBooleanEnv('ALLOW_DEFAULT_COMPANY_BOOTSTRAP', false);
  }

  private getDefaultCompanyCode() {
    const code = process.env.DEFAULT_COMPANY_CODE?.trim();
    return code || 'DEFAULT';
  }

  private getDefaultCompanyName() {
    const name = process.env.DEFAULT_COMPANY_NAME?.trim();
    return name || 'Empresa principal';
  }

  private async ensureDefaultCompany() {
    const code = this.getDefaultCompanyCode();

    return this.prisma.company.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: this.getDefaultCompanyName(),
      },
    });
  }

  /**
   * Obtiene el usuario por su Firebase UID, incluyendo información de la empresa.
   * Retorna null si no se encuentra el usuario.
   */
  private async getUserAccessByFirebaseUid(firebaseUid: string) {
    return this.prisma.user.findUnique({
      where: { firebaseUid },
      select: {
        id: true,
        companyId: true,
        firebaseUid: true,
        email: true,
        name: true,
        phone: true,
        birthDate: true,
        role: true,
        workerGroup: true,
        internshipTotalHours: true,
        vacationAllowanceDays: true,
        overtimeBankMinutesAdjustment: true,
        createdAt: true,
        company: {
          select: {
            id: true,
            isActive: true,
          },
        },
      },
    });
  }

  private assertPlatformUserRegistered(
    user: {
      company: {
        isActive: boolean;
      };
    } | null,
  ) {
    if (!user) {
      throw new NotFoundException('Usuario no registrado en la plataforma');
    }
    if (!user.company.isActive) {
      throw new BadRequestException('La empresa está desactivada');
    }
  }

  async upsertFromToken(
    firebaseUid: string,
    email: string | null,
    name: string | null,
  ) {
    const existing = await this.getUserAccessByFirebaseUid(firebaseUid);
    if (!existing) {
      if (!this.isDefaultCompanyBootstrapEnabled()) {
        throw new NotFoundException('Usuario no registrado en la plataforma');
      }

      const company = await this.ensureDefaultCompany();
      return this.prisma.user.create({
        data: {
          firebaseUid,
          companyId: company.id,
          email,
          name,
        },
        select: userProfileSelect,
      });
    }

    this.assertPlatformUserRegistered(existing);
    const data: Prisma.UserUpdateInput = {};
    const nextEmail = normalizeNullableText(email);
    const tokenName = normalizeNullableText(name);

    if (nextEmail && nextEmail !== existing.email) {
      data.email = nextEmail;
    }

    // El nombre editable del perfil se conserva en la BD. Solo usamos el del
    // token como relleno inicial si el usuario aún no tiene nombre guardado.
    if (!existing.name && tokenName) {
      data.name = tokenName;
    }

    if (!Object.keys(data).length) {
      const profile = await this.prisma.user.findUnique({
        where: { id: existing.id },
        select: userProfileSelect,
      });
      if (!profile) {
        throw new NotFoundException('Usuario no encontrado');
      }
      return profile;
    }

    return this.prisma.user.update({
      where: { id: existing.id },
      data,
      select: userProfileSelect,
    });
  }

  async findOrCreateByFirebaseUid(firebaseUid: string) {
    const existing = await this.getUserAccessByFirebaseUid(firebaseUid);
    if (existing) {
      this.assertPlatformUserRegistered(existing);
      const user = await this.prisma.user.findUnique({
        where: { id: existing.id },
      });
      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }
      return user;
    }

    if (!this.isDefaultCompanyBootstrapEnabled()) {
      throw new NotFoundException('Usuario no registrado en la plataforma');
    }

    const company = await this.ensureDefaultCompany();
    return this.prisma.user.create({
      data: {
        firebaseUid,
        companyId: company.id,
      },
    });
  }

  async getByFirebaseUid(firebaseUid: string) {
    const user = await this.getUserAccessByFirebaseUid(firebaseUid);
    this.assertPlatformUserRegistered(user);
    const fullUser = await this.prisma.user.findUnique({
      where: { firebaseUid },
    });
    if (!fullUser) throw new NotFoundException('Usuario no encontrado');
    return fullUser;
  }

  async getProfileByFirebaseUid(firebaseUid: string) {
    const user = await this.findOrCreateByFirebaseUid(firebaseUid);
    const profile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: userProfileSelect,
    });
    if (!profile) throw new NotFoundException('Usuario no encontrado');
    return profile;
  }

  async updateMyProfile(firebaseUid: string, dto: UpdateMyProfileDto) {
    const user = await this.getByFirebaseUid(firebaseUid);

    const data: Prisma.UserUpdateInput = {};
    const firebasePatch: { email?: string; displayName?: string | null } = {};

    if (dto.name !== undefined) {
      const nextName = normalizeOptionalText(dto.name);
      data.name = nextName;
      firebasePatch.displayName = nextName;
    }

    if (dto.phone !== undefined) {
      data.phone = normalizeOptionalText(dto.phone);
    }

    if (dto.birthDate !== undefined) {
      const raw = dto.birthDate.trim();
      data.birthDate = raw ? parseBirthDate(raw) : null;
    }

    if (dto.email !== undefined) {
      const nextEmail = dto.email.trim().toLowerCase();
      if (!nextEmail) {
        throw new BadRequestException('El email no puede estar vacío');
      }

      const duplicatedEmail = await this.prisma.user.findFirst({
        where: {
          companyId: user.companyId,
          id: { not: user.id },
          email: { equals: nextEmail, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (duplicatedEmail) {
        throw new BadRequestException('Ya existe otro usuario con ese email');
      }

      data.email = nextEmail;
      firebasePatch.email = nextEmail;
    }

    if (!Object.keys(data).length) {
      const profile = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: userProfileSelect,
      });
      if (!profile) throw new NotFoundException('Usuario no encontrado');
      return profile;
    }

    if (Object.keys(firebasePatch).length > 0) {
      try {
        const firebaseApp = getFirebaseAdminApp();
        await firebaseApp.auth().updateUser(user.firebaseUid, firebasePatch);
      } catch (error) {
        if (hasFirebaseErrorCode(error, 'auth/email-already-exists')) {
          throw new BadRequestException(
            'Ese email ya está registrado en Firebase',
          );
        }
        if (hasFirebaseErrorCode(error, 'auth/invalid-email')) {
          throw new BadRequestException('Email inválido');
        }
        throw new BadRequestException(
          'No se pudo actualizar el perfil en Firebase',
        );
      }
    }

    return this.prisma.user.update({
      where: { id: user.id },
      data,
      select: userProfileSelect,
    });
  }

  async deleteMyAccount(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      select: {
        id: true,
        companyId: true,
        firebaseUid: true,
        role: true,
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (user.role === 'ADMIN') {
      const totalAdmins = await this.prisma.user.count({
        where: {
          companyId: user.companyId,
          role: 'ADMIN',
        },
      });
      if (totalAdmins <= 1) {
        throw new BadRequestException(
          'No puedes eliminar el último administrador de la empresa',
        );
      }
    }

    const firebaseApp = getFirebaseAdminApp();
    try {
      await firebaseApp.auth().deleteUser(user.firebaseUid);
    } catch (error) {
      if (!hasFirebaseErrorCode(error, 'auth/user-not-found')) {
        throw new BadRequestException(
          'No se pudo eliminar la cuenta en Firebase',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.request.updateMany({
        where: { reviewedById: user.id },
        data: { reviewedById: null },
      });

      const deleted = await tx.user.deleteMany({
        where: { id: user.id, companyId: user.companyId },
      });
      if (deleted.count !== 1) {
        throw new NotFoundException('Usuario no encontrado');
      }
    });

    return { deleted: true };
  }

  private async getClosedShifts(userId: string) {
    return this.prisma.shift.findMany({
      where: { userId, endAt: { not: null } },
      select: { startAt: true, endAt: true },
      orderBy: { startAt: 'asc' },
    });
  }

  async getInternshipConsumedMinutes(userId: string) {
    const shifts = await this.getClosedShifts(userId);
    return shifts.reduce(
      (acc, s) => acc + minutesBetween(s.startAt, s.endAt),
      0,
    );
  }

  async getWeeklyMinutes(userId: string, now = new Date()) {
    const weekStart = startOfIsoWeekUTC(now);
    const shifts = await this.prisma.shift.findMany({
      where: {
        userId,
        startAt: { gte: weekStart },
        endAt: { not: null },
      },
      select: { startAt: true, endAt: true },
      orderBy: { startAt: 'asc' },
    });

    return shifts.reduce(
      (acc, s) => acc + minutesBetween(s.startAt, s.endAt),
      0,
    );
  }

  async getProgressByUserId(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const weekStart = startOfIsoWeekUTC(new Date());
    const weekEnd = addDaysUTC(weekStart, 7);
    const yearStart = new Date(
      Date.UTC(new Date().getUTCFullYear(), 0, 1, 0, 0, 0),
    );
    const yearEnd = new Date(
      Date.UTC(new Date().getUTCFullYear() + 1, 0, 1, 0, 0, 0),
    );

    const [
      consumedMinutes,
      weeklyMinutes,
      openShift,
      pendingOvertimeRequests,
      expectedWeekMinutesByUser,
      vacationUsage,
      overtimeUsage,
    ] = await Promise.all([
      this.getInternshipConsumedMinutes(user.id),
      this.getWeeklyMinutes(user.id),
      this.prisma.shift.findFirst({
        where: { userId: user.id, endAt: null },
        select: { id: true, startAt: true },
      }),
      this.prisma.request.findMany({
        where: {
          userId: user.id,
          type: 'OVERTIME',
          status: 'PENDING',
          startAt: { gte: weekStart },
        },
        select: { startAt: true, endAt: true },
      }),
      calculateExpectedWorkMinutes({
        prisma: this.prisma,
        companyId: user.companyId,
        userIds: [user.id],
        from: weekStart,
        toExclusive: weekEnd,
      }),
      calculateVacationDayUsage({
        prisma: this.prisma,
        userId: user.id,
        from: yearStart,
        toExclusive: yearEnd,
      }),
      calculateOvertimeMinutes({
        prisma: this.prisma,
        userId: user.id,
        from: yearStart,
        toExclusive: yearEnd,
      }),
    ]);

    const consumedHours = Number((consumedMinutes / 60).toFixed(2));
    const totalHours = user.internshipTotalHours ?? 0;
    const pendingHours = Number(
      Math.max(0, totalHours - consumedHours).toFixed(2),
    );

    const weeklyLimitHours = Number(process.env.WEEKLY_LIMIT_HOURS ?? '40');
    const weeklyHours = Number((weeklyMinutes / 60).toFixed(2));
    const pendingOvertimeMinutes = pendingOvertimeRequests.reduce((acc, r) => {
      const diff = new Date(r.endAt).getTime() - new Date(r.startAt).getTime();
      return acc + (diff > 0 ? Math.ceil(diff / 60000) : 0);
    }, 0);
    const pendingOvertimeHours = Number(
      (pendingOvertimeMinutes / 60).toFixed(2),
    );
    const expectedWeekMinutes = expectedWeekMinutesByUser.get(user.id) ?? 0;
    const expectedWeekHours = Number((expectedWeekMinutes / 60).toFixed(2));
    const weeklyBalanceHours = Number(
      ((weeklyMinutes - expectedWeekMinutes) / 60).toFixed(2),
    );
    const vacationAllowanceDays =
      user.vacationAllowanceDays ??
      Number(process.env.DEFAULT_VACATION_ALLOWANCE_DAYS ?? '22');
    const vacationAvailableDays = Number(
      Math.max(0, vacationAllowanceDays - vacationUsage.approvedDays).toFixed(
        2,
      ),
    );
    const overtimeBankMinutes =
      overtimeUsage.approvedMinutes + user.overtimeBankMinutesAdjustment;
    const overtimeBankHours = Number((overtimeBankMinutes / 60).toFixed(2));

    return {
      userId: user.id,
      role: user.role,
      workerGroup: user.workerGroup,
      internship: {
        totalHours,
        consumedHours,
        pendingHours,
        warningAtRemainingHours: 40,
        warningTriggered:
          user.workerGroup === 'INTERN' && totalHours > 0 && pendingHours <= 40,
      },
      weekly: {
        limitHours: weeklyLimitHours,
        workedHours: weeklyHours,
        expectedHours: expectedWeekHours,
        balanceHours: weeklyBalanceHours,
        exceeded:
          user.workerGroup === 'EMPLOYEE' && weeklyHours > weeklyLimitHours,
        pendingOvertimeHours,
      },
      vacation: {
        allowanceDays: vacationAllowanceDays,
        approvedDays: vacationUsage.approvedDays,
        pendingDays: vacationUsage.pendingDays,
        availableDays: vacationAvailableDays,
      },
      overtimeBank: {
        approvedHours: Number((overtimeUsage.approvedMinutes / 60).toFixed(2)),
        pendingHours: Number((overtimeUsage.pendingMinutes / 60).toFixed(2)),
        adjustmentHours: Number(
          (user.overtimeBankMinutesAdjustment / 60).toFixed(2),
        ),
        balanceHours: overtimeBankHours,
      },
      openShift: openShift
        ? {
            id: openShift.id,
            startAt: openShift.startAt,
          }
        : null,
    };
  }

  async getProgressByFirebaseUid(firebaseUid: string) {
    const user = await this.findOrCreateByFirebaseUid(firebaseUid);
    return this.getProgressByUserId(user.id);
  }

  getCurrentWeekStart(now = new Date()) {
    return startOfIsoWeekUTC(now);
  }
}

function addDaysUTC(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}
