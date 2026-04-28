import {
  BadRequestException,
  InternalServerErrorException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AuditAction, Prisma, Role, WorkerGroup } from '@prisma/client';
import { spawn, spawnSync } from 'child_process';
import { createHash, randomBytes } from 'crypto';
import fs from 'fs';
import { DateTime } from 'luxon';
import path from 'path';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { getFirebaseAdminApp } from '../auth/firebase-admin';
import { ScheduleService } from '../schedule/schedule.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { ReviewRequestDto } from './dto/review-request.dto';
import { UpdateUserGroupDto } from './dto/update-user-group.dto';
import { UpdateInternshipHoursDto } from './dto/update-internship-hours.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { SetWorkplaceDto } from './dto/set-workplace.dto';
import { UpsertWorkplaceDto } from './dto/upsert-workplace.dto';
import { AssignRequestDto } from './dto/assign-request.dto';
import { UpdateCompanyLocationDto } from './dto/update-company-location.dto';
import { CreateHolidayDto, UpdateHolidayDto } from './dto/upsert-holiday.dto';
import { ImportOfficialHolidaysDto } from './dto/import-official-holidays.dto';
import { SendTestEmailDto } from './dto/send-test-email.dto';
import {
  OPENCLAW_AGENT_SCOPES,
  RotateOpenClawTokenDto,
} from './dto/openclaw-integration.dto';
import {
  calculateExpectedWorkMinutes,
  calculateOvertimeMinutes,
  calculateVacationDayUsage,
} from '../shared/work-metrics';
import { normalizeInternationalPhone } from '../shared/phone';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import ExcelJS from 'exceljs';

const MADRID_LOCAL_HOLIDAYS_URL =
  'https://datos.comunidad.madrid/dataset/f160eb6c-6715-471e-9bc0-38497aae950f/resource/db6a3cb0-5504-4db8-9fe7-e42af1ae329b/download/festivos_locales.json';
const MADRID_REGIONAL_HOLIDAYS_URL =
  'https://datos.comunidad.madrid/dataset/f160eb6c-6715-471e-9bc0-38497aae950f/resource/975f579d-92c2-42de-bfa9-aff5bd164586/download/festivos_regionales.json';
const MADRID_REGION_NAME = 'Comunidad de Madrid';
const MADRID_PROVINCE_NAME = 'Madrid';
const SPAIN_COUNTRY_NAME = 'España';
const MADRID_NATIONAL_HOLIDAY_NAMES = new Set([
  'ano nuevo',
  'epifania del senor',
  'viernes santo',
  'fiesta del trabajo',
  'asuncion de la virgen',
  'fiesta nacional de espana',
  'todos los santos',
  'dia de la constitucion espanola',
  'inmaculada concepcion',
  'natividad del senor',
]);

const workplaceSelect = {
  id: true,
  companyId: true,
  name: true,
  addressLabel: true,
  country: true,
  region: true,
  province: true,
  municipality: true,
  postalCode: true,
  lat: true,
  lng: true,
  radiusMeters: true,
  maxAllowedAccuracy: true,
  strictMode: true,
  isPrimary: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

function parseDateOnly(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m)
    throw new BadRequestException('Formato de fecha inválido. Usa YYYY-MM-DD');
  return new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0),
  );
}

function addDaysUTC(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function hasFirebaseErrorCode(error: unknown, code: string): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: string }).code === code;
}

function isMissingAuditStorage(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return error.code === 'P2021' || error.code === 'P2022';
}

function getFirebaseWebApiKey(): string | null {
  const key =
    process.env.FIREBASE_WEB_API_KEY ?? process.env.FIREBASE_API_KEY ?? '';
  const normalized = key.trim();
  return normalized || null;
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = (value ?? '').trim();
  return normalized || null;
}

function normalizeMatchText(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeSpreadsheetHeader(value: string | null | undefined) {
  return normalizeMatchText(value).replace(/[^a-z0-9]+/g, ' ').trim();
}

function parseImportedRole(value: string): Role {
  const normalized = normalizeMatchText(value);
  if (!normalized) return 'EMPLOYEE';
  if (['admin', 'administrador', 'administrator'].includes(normalized)) {
    return 'ADMIN';
  }
  if (
    ['employee', 'empleado', 'trabajador', 'worker', 'usuario'].includes(
      normalized,
    )
  ) {
    return 'EMPLOYEE';
  }
  throw new BadRequestException(
    'Rol inválido. Usa ADMIN, Administrador, EMPLOYEE, Empleado o Trabajador',
  );
}

function parseImportedWorkerGroup(value: string): WorkerGroup {
  const normalized = normalizeMatchText(value);
  if (!normalized) return 'EMPLOYEE';
  if (
    ['employee', 'empleado', 'trabajador', 'worker'].includes(normalized)
  ) {
    return 'EMPLOYEE';
  }
  if (
    [
      'intern',
      'practicas',
      'practica',
      'becario',
      'becaria',
      'alumno practicas',
      'alumna practicas',
    ].includes(normalized)
  ) {
    return 'INTERN';
  }
  throw new BadRequestException(
    'Grupo inválido. Usa EMPLOYEE, Trabajador, INTERN, Prácticas o Becario',
  );
}

function excelCellToText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (value instanceof Date) {
    return DateTime.fromJSDate(value).toFormat('dd/LL/yyyy');
  }
  if (typeof value === 'object') {
    if (
      'text' in value &&
      typeof (value as { text?: unknown }).text === 'string'
    ) {
      return String((value as { text: string }).text).trim();
    }
    if (
      'result' in value &&
      (typeof (value as { result?: unknown }).result === 'string' ||
        typeof (value as { result?: unknown }).result === 'number')
    ) {
      return String((value as { result: string | number }).result).trim();
    }
    if (
      'richText' in value &&
      Array.isArray((value as { richText?: Array<{ text?: string }> }).richText)
    ) {
      return (value as { richText: Array<{ text?: string }> }).richText
        .map((part) => part.text || '')
        .join('')
        .trim();
    }
  }
  return String(value).trim();
}

function classifyMadridHolidayScope(name: string) {
  return MADRID_NATIONAL_HOLIDAY_NAMES.has(normalizeMatchText(name))
    ? 'NATIONAL'
    : 'REGIONAL';
}

type MadridRegionalHolidayItem = {
  festividad?: string;
  año?: string;
  fecha_festivo?: string;
};

type MadridLocalHolidayItem = {
  municipio_nombre?: string;
  entidad_nombre?: string;
  año?: string;
  fecha_festivo?: string;
};

type MadridDatasetResponse<T> = {
  data?: T[];
};

type UserAuditSnapshot = {
  role: string;
  workerGroup: string;
  internshipTotalHours: number | null;
  vacationAllowanceDays: number | null;
  overtimeBankMinutesAdjustment: number;
};

type UserAuditValue = string | number | null;
type UserAuditField = keyof UserAuditSnapshot;
type RequestNotificationRecord = {
  id: string;
  userId: string;
  type: string;
  status: string;
  source: string;
  startAt: Date;
  endAt: Date;
  comment: string | null;
  reviewComment?: string | null;
  reviewedAt?: Date | null;
  reviewedById?: string | null;
  createdAt: Date;
  user?: {
    email: string | null;
    name: string | null;
  } | null;
};

function buildUserChangesMeta(
  before: UserAuditSnapshot,
  after: UserAuditSnapshot,
  fields?: UserAuditField[],
) {
  const changes: Record<string, { from: UserAuditValue; to: UserAuditValue }> =
    {};
  const selected = new Set<UserAuditField>(
    fields ?? ['role', 'workerGroup', 'internshipTotalHours'],
  );

  if (selected.has('role') && before.role !== after.role) {
    changes.role = { from: before.role, to: after.role };
  }

  if (selected.has('workerGroup') && before.workerGroup !== after.workerGroup) {
    changes.workerGroup = { from: before.workerGroup, to: after.workerGroup };
  }

  if (
    selected.has('internshipTotalHours') &&
    before.internshipTotalHours !== after.internshipTotalHours
  ) {
    changes.internshipTotalHours = {
      from: before.internshipTotalHours,
      to: after.internshipTotalHours,
    };
  }

  if (
    selected.has('vacationAllowanceDays') &&
    before.vacationAllowanceDays !== after.vacationAllowanceDays
  ) {
    changes.vacationAllowanceDays = {
      from: before.vacationAllowanceDays,
      to: after.vacationAllowanceDays,
    };
  }

  if (
    selected.has('overtimeBankMinutesAdjustment') &&
    before.overtimeBankMinutesAdjustment !== after.overtimeBankMinutesAdjustment
  ) {
    changes.overtimeBankMinutesAdjustment = {
      from: before.overtimeBankMinutesAdjustment,
      to: after.overtimeBankMinutesAdjustment,
    };
  }

  return changes;
}

type BackupTrigger = 'MANUAL' | 'AUTO';

type BackupSnapshot = {
  trigger: BackupTrigger;
  fileName: string;
  filePath: string;
  sizeBytes: number;
  startedAt: string;
  finishedAt: string;
};

function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parsePositiveIntEnv(value: string | undefined, fallback: number) {
  const n = Number(value ?? '');
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.trunc(n);
}

function backupStamp(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(
    date.getDate(),
  )}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function buildOpenClawToken() {
  return `ocla_${randomBytes(32).toString('base64url')}`;
}

function hashOpenClawToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function previewOpenClawToken(token: string) {
  return `${token.slice(0, 10)}...${token.slice(-6)}`;
}

function normalizeOpenClawScopes(scopes?: string[]) {
  if (!scopes?.length) return [...OPENCLAW_AGENT_SCOPES];
  return [...new Set(scopes)];
}

function cleanEnv(name: string) {
  return (process.env[name] ?? '').trim();
}

function hasRealEnvValue(name: string) {
  const value = cleanEnv(name);
  if (!value) return false;
  return !/^YOUR_|^CHANGE_|^TODO|tu-dominio|example/i.test(value);
}

function envEnabled(name: string, fallback = false) {
  return parseBooleanEnv(process.env[name], fallback);
}

function isLocalDatabaseUrl(databaseUrl: string) {
  if (!databaseUrl) return false;
  try {
    const url = new URL(databaseUrl);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname);
  } catch {
    return databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
  }
}

@Injectable()
export class AdminService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminService.name);
  private readonly autoBackupEnabled = parseBooleanEnv(
    process.env.AUTO_BACKUP_ENABLED,
    true,
  );
  private readonly autoBackupIntervalHours = parsePositiveIntEnv(
    process.env.AUTO_BACKUP_INTERVAL_HOURS,
    24,
  );
  private readonly backupRetentionDays = parsePositiveIntEnv(
    process.env.BACKUP_RETENTION_DAYS,
    30,
  );
  private readonly backupDir = path.resolve(
    process.cwd(),
    process.env.BACKUP_DIR || 'backups',
  );
  private autoBackupTimer: NodeJS.Timeout | null = null;
  private nextAutoBackupAt: Date | null = null;
  private backupInProgress = false;
  private lastBackup: BackupSnapshot | null = null;
  private lastBackupError: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduleService: ScheduleService,
    private readonly mailService: MailService,
    private readonly whatsappService: WhatsappService,
  ) {}

  onModuleInit() {
    this.ensureBackupDir();
    this.syncLatestBackupFromDisk();
    const deletedOnStart = this.pruneOldBackups();
    if (deletedOnStart > 0) {
      this.logger.log(
        `Limpieza inicial de backups: ${deletedOnStart} archivo(s) eliminado(s).`,
      );
    }
    if (!this.autoBackupEnabled) {
      this.logger.log('Auto-backup desactivado por configuración.');
      return;
    }

    const intervalMs = this.autoBackupIntervalHours * 60 * 60 * 1000;
    this.nextAutoBackupAt = new Date(Date.now() + intervalMs);

    this.autoBackupTimer = setInterval(() => {
      this.nextAutoBackupAt = new Date(Date.now() + intervalMs);
      void this.runScheduledBackup();
    }, intervalMs);
    this.autoBackupTimer.unref?.();

    this.logger.log(
      `Auto-backup activo cada ${this.autoBackupIntervalHours}h en ${this.backupDir} (retención ${this.backupRetentionDays} días)`,
    );
  }

  onModuleDestroy() {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = null;
    }
  }

  private ensureBackupDir() {
    fs.mkdirSync(this.backupDir, { recursive: true });
  }

  private addPgToolsToPathIfNeeded() {
    const candidates = [
      '/opt/homebrew/opt/libpq/bin',
      '/usr/local/opt/libpq/bin',
    ];
    const currentPath = process.env.PATH || '';
    const parts = currentPath.split(':');

    for (const dir of candidates) {
      if (!fs.existsSync(dir)) continue;
      if (parts.includes(dir)) continue;
      process.env.PATH = `${dir}:${process.env.PATH || ''}`;
    }
  }

  private ensurePgDumpAvailable() {
    this.addPgToolsToPathIfNeeded();
    const probe = spawnSync('which', ['pg_dump'], { encoding: 'utf8' });
    if (probe.status === 0) return;
    throw new BadRequestException(
      'No se encontró pg_dump. Instala cliente PostgreSQL (libpq).',
    );
  }

  private buildBackupFilePath(startedAt: Date) {
    const fileName = `fichar-backup-${backupStamp(startedAt)}.sql`;
    return path.join(this.backupDir, fileName);
  }

  private executePgDump(databaseUrl: string, outputFile: string) {
    return new Promise<void>((resolve, reject) => {
      const args = [
        '--dbname',
        databaseUrl,
        '--format=plain',
        '--encoding=UTF8',
        '--no-owner',
        '--no-privileges',
        '--file',
        outputFile,
      ];

      const child = spawn('pg_dump', args, { env: process.env });
      let stderr = '';

      child.stderr.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(
          new Error(stderr.trim() || `pg_dump terminó con código ${code}`),
        );
      });
    });
  }

  private scanLatestBackupFile() {
    this.ensureBackupDir();
    const files = fs
      .readdirSync(this.backupDir)
      .filter((name) => /^fichar-backup-\d{8}-\d{6}\.sql$/.test(name))
      .map((name) => {
        const filePath = path.join(this.backupDir, name);
        const stat = fs.statSync(filePath);
        return { name, filePath, mtimeMs: stat.mtimeMs, sizeBytes: stat.size };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    return files[0] || null;
  }

  private pruneOldBackups() {
    this.ensureBackupDir();
    const cutoffMs =
      Date.now() - this.backupRetentionDays * 24 * 60 * 60 * 1000;
    const files = fs
      .readdirSync(this.backupDir)
      .filter((name) => /^fichar-backup-\d{8}-\d{6}\.sql$/.test(name));

    let deleted = 0;
    for (const name of files) {
      const filePath = path.join(this.backupDir, name);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs >= cutoffMs) continue;
      fs.unlinkSync(filePath);
      deleted += 1;
    }

    return deleted;
  }

  private syncLatestBackupFromDisk() {
    const latest = this.scanLatestBackupFile();
    if (!latest) return;
    this.lastBackup = {
      trigger: 'AUTO',
      fileName: latest.name,
      filePath: latest.filePath,
      sizeBytes: latest.sizeBytes,
      startedAt: new Date(latest.mtimeMs).toISOString(),
      finishedAt: new Date(latest.mtimeMs).toISOString(),
    };
  }

  private async runBackup(trigger: BackupTrigger) {
    if (this.backupInProgress) {
      throw new BadRequestException('Ya hay un backup en progreso.');
    }

    const databaseUrl = (process.env.DATABASE_URL || '').trim();
    if (!databaseUrl) {
      throw new BadRequestException(
        'No se puede crear backup: falta DATABASE_URL en el servidor.',
      );
    }

    this.ensurePgDumpAvailable();
    this.ensureBackupDir();

    const startedAt = new Date();
    const outputFile = this.buildBackupFilePath(startedAt);
    this.backupInProgress = true;
    this.lastBackupError = null;

    try {
      await this.executePgDump(databaseUrl, outputFile);
      const stat = fs.statSync(outputFile);
      const snapshot: BackupSnapshot = {
        trigger,
        fileName: path.basename(outputFile),
        filePath: outputFile,
        sizeBytes: stat.size,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
      };
      this.lastBackup = snapshot;
      const deleted = this.pruneOldBackups();
      if (deleted > 0) {
        this.logger.log(
          `Limpieza de backups: ${deleted} archivo(s) eliminado(s) (> ${this.backupRetentionDays} días).`,
        );
      }
      return snapshot;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido en pg_dump';
      this.lastBackupError = message;
      throw new InternalServerErrorException(
        `No se pudo generar el backup: ${message}`,
      );
    } finally {
      this.backupInProgress = false;
    }
  }

  private async runScheduledBackup() {
    if (this.backupInProgress) {
      this.logger.warn(
        'Auto-backup omitido porque ya hay un backup en ejecución.',
      );
      return;
    }
    try {
      const snapshot = await this.runBackup('AUTO');
      this.logger.log(
        `Auto-backup completado: ${snapshot.fileName} (${snapshot.sizeBytes} bytes)`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`Error en auto-backup: ${message}`);
    }
  }

  private async getAdminForAudit(firebaseUidAdmin: string) {
    const admin = await this.prisma.user.findUnique({
      where: { firebaseUid: firebaseUidAdmin },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
      },
    });

    if (!admin) throw new NotFoundException('Admin no encontrado');
    if (admin.role !== 'ADMIN') {
      throw new BadRequestException('Acceso solo para administradores');
    }
    return admin;
  }

  private serializeOpenClawIntegration(
    integration: {
      id: string;
      provider: string;
      isEnabled: boolean;
      tokenPreview: string | null;
      scopes: string[];
      lastUsedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    } | null,
  ) {
    if (!integration) {
      return {
        id: null,
        provider: 'OPENCLAW',
        isEnabled: false,
        tokenPreview: null,
        scopes: [...OPENCLAW_AGENT_SCOPES],
        lastUsedAt: null,
        createdAt: null,
        updatedAt: null,
      };
    }

    return integration;
  }

  async getOpenClawIntegration(firebaseUidAdmin: string) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);
    const integration = await this.prisma.agentIntegration.findUnique({
      where: {
        companyId_provider: {
          companyId: admin.companyId,
          provider: 'OPENCLAW',
        },
      },
      select: {
        id: true,
        provider: true,
        isEnabled: true,
        tokenPreview: true,
        scopes: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return this.serializeOpenClawIntegration(integration);
  }

  async getOpenClawAccessLogs(firebaseUidAdmin: string, limitRaw?: string) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);
    const parsedLimit = Number(limitRaw ?? '30');
    const take =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(Math.trunc(parsedLimit), 100)
        : 30;

    return this.prisma.agentAccessLog.findMany({
      where: {
        companyId: admin.companyId,
        provider: 'OPENCLAW',
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        status: true,
        reason: true,
        method: true,
        path: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        integration: {
          select: {
            tokenPreview: true,
          },
        },
      },
    });
  }

  async rotateOpenClawToken(
    firebaseUidAdmin: string,
    dto: RotateOpenClawTokenDto,
  ) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);
    const token = buildOpenClawToken();
    const integration = await this.prisma.agentIntegration.upsert({
      where: {
        companyId_provider: {
          companyId: admin.companyId,
          provider: 'OPENCLAW',
        },
      },
      update: {
        isEnabled: true,
        tokenHash: hashOpenClawToken(token),
        tokenPreview: previewOpenClawToken(token),
        scopes: normalizeOpenClawScopes(dto.scopes),
      },
      create: {
        companyId: admin.companyId,
        provider: 'OPENCLAW',
        isEnabled: true,
        tokenHash: hashOpenClawToken(token),
        tokenPreview: previewOpenClawToken(token),
        scopes: normalizeOpenClawScopes(dto.scopes),
      },
      select: {
        id: true,
        provider: true,
        isEnabled: true,
        tokenPreview: true,
        scopes: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      integration,
      token,
      warning:
        'Guarda este token ahora. Por seguridad, la API solo almacenará su hash y no podrá volver a mostrarlo completo.',
    };
  }

  async revokeOpenClawIntegration(firebaseUidAdmin: string) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);
    await this.prisma.agentIntegration.updateMany({
      where: {
        companyId: admin.companyId,
        provider: 'OPENCLAW',
      },
      data: {
        isEnabled: false,
        tokenHash: null,
        tokenPreview: null,
      },
    });

    return this.getOpenClawIntegration(firebaseUidAdmin);
  }

  private async syncApprovedRequestToSchedule(request: {
    userId: string;
    type: string;
    startAt: Date;
    endAt: Date;
    comment: string | null;
  }) {
    if (
      request.type === 'VACATION' ||
      request.type === 'SICK_LEAVE' ||
      request.type === 'DAY_OFF'
    ) {
      await this.scheduleService.syncRangeByType(
        request.userId,
        request.startAt,
        request.endAt,
        request.type,
        request.comment,
      );
    }
  }

  private getRequestTypeLabel(type: string) {
    switch (type) {
      case 'VACATION':
        return 'vacaciones';
      case 'SICK_LEAVE':
        return 'baja médica';
      case 'DAY_OFF':
        return 'día libre';
      case 'OVERTIME':
        return 'horas extra';
      case 'CORRECTION':
        return 'corrección';
      default:
        return type.toLowerCase();
    }
  }

  private formatRequestPeriod(request: {
    type: string;
    startAt: Date;
    endAt: Date;
  }) {
    const onlyDateTypes = new Set(['VACATION', 'SICK_LEAVE', 'DAY_OFF']);
    const format = onlyDateTypes.has(request.type)
      ? 'dd/LL/yyyy'
      : 'dd/LL/yyyy HH:mm';

    const start = DateTime.fromJSDate(request.startAt)
      .setZone('Europe/Madrid')
      .toFormat(format);
    const end = DateTime.fromJSDate(request.endAt)
      .setZone('Europe/Madrid')
      .toFormat(format);

    return start === end ? start : `${start} - ${end}`;
  }

  private formatActorName(admin: {
    name: string | null;
    email: string | null;
  }) {
    return admin.name?.trim() || admin.email?.trim() || 'Administración';
  }

  private async sendEmailSafely(
    to: string | null | undefined,
    subject: string,
    text: string,
    context: string,
  ) {
    const recipient = to?.trim();
    if (!recipient) return;

    try {
      await this.mailService.sendTextEmail(recipient, subject, text);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`No se pudo enviar correo (${context}): ${message}`);
    }
  }

  private async sendWhatsappReviewedRequestNotificationSafely(
    companyId: string,
    request: RequestNotificationRecord,
    adminName: string,
    action: 'APPROVED' | 'REJECTED',
  ) {
    if (!request.type || !request.startAt || !request.endAt) {
      return;
    }

    try {
      await this.whatsappService.sendReviewedRequestNotification({
        companyId,
        userId: request.userId,
        action,
        typeLabel: this.getRequestTypeLabel(request.type),
        periodLabel: this.formatRequestPeriod(request),
        adminName,
        employeeComment: request.comment,
        reviewComment: request.reviewComment,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(
        `No se pudo enviar WhatsApp de solicitud (${request.id}): ${message}`,
      );
    }
  }

  private async sendReviewedRequestNotification(
    admin: { name: string | null; email: string | null },
    request: RequestNotificationRecord,
    action: 'APPROVED' | 'REJECTED',
  ) {
    const recipient = request.user?.email?.trim();
    if (!recipient) return;

    const actionLabel = action === 'APPROVED' ? 'aprobada' : 'rechazada';
    const employeeName = request.user?.name?.trim() || 'usuario';
    const typeLabel = this.getRequestTypeLabel(request.type);
    const period = this.formatRequestPeriod(request);
    const adminName = this.formatActorName(admin);
    const reviewComment = request.reviewComment?.trim();
    const employeeComment = request.comment?.trim();

    const lines = [
      `Hola ${employeeName},`,
      '',
      `Tu solicitud de ${typeLabel} ha sido ${actionLabel}.`,
      `Periodo: ${period}`,
      `Revisado por: ${adminName}`,
    ];

    if (employeeComment) {
      lines.push(`Comentario original: ${employeeComment}`);
    }
    if (reviewComment) {
      lines.push(`Comentario del administrador: ${reviewComment}`);
    }

    lines.push('', 'Puedes revisar el detalle en la plataforma.');

    await this.sendEmailSafely(
      recipient,
      `Solicitud ${actionLabel}: ${typeLabel}`,
      lines.join('\n'),
      `request-${request.id}-${action.toLowerCase()}`,
    );
  }

  private async sendAssignedRequestNotification(
    admin: { name: string | null; email: string | null },
    request: RequestNotificationRecord,
  ) {
    const recipient = request.user?.email?.trim();
    if (!recipient) return;

    const employeeName = request.user?.name?.trim() || 'usuario';
    const typeLabel = this.getRequestTypeLabel(request.type);
    const period = this.formatRequestPeriod(request);
    const adminName = this.formatActorName(admin);
    const assignmentComment = request.comment?.trim();

    const lines = [
      `Hola ${employeeName},`,
      '',
      `La empresa te ha registrado ${typeLabel}.`,
      `Periodo: ${period}`,
      `Gestionado por: ${adminName}`,
    ];

    if (assignmentComment) {
      lines.push(`Comentario: ${assignmentComment}`);
    }

    lines.push('', 'Puedes revisar el detalle en la plataforma.');

    await this.sendEmailSafely(
      recipient,
      `Asignación registrada: ${typeLabel}`,
      lines.join('\n'),
      `request-${request.id}-assignment`,
    );
  }

  private async createAssignedRequest(
    firebaseUidAdmin: string,
    dto: AssignRequestDto,
    type: 'VACATION' | 'SICK_LEAVE' | 'DAY_OFF' | 'OVERTIME',
  ) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    const targetUser = await this.prisma.user.findFirst({
      where: {
        id: dto.userId,
        companyId: admin.companyId,
      },
      select: { id: true },
    });
    if (!targetUser) throw new NotFoundException('Usuario no encontrado');

    const start = new Date(dto.startAt);
    const end = new Date(dto.endAt);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('startAt/endAt inválidos');
    }

    if (end <= start) {
      throw new BadRequestException('endAt debe ser posterior a startAt');
    }

    const created = await this.prisma.request.create({
      data: {
        userId: targetUser.id,
        type,
        status: 'APPROVED',
        source: 'COMPANY',
        startAt: start,
        endAt: end,
        comment: dto.comment ?? null,
        reviewedAt: new Date(),
        reviewedById: admin.id,
      },
      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
        source: true,
        startAt: true,
        endAt: true,
        comment: true,
        reviewedAt: true,
        reviewedById: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    await this.syncApprovedRequestToSchedule(created);
    await this.sendAssignedRequestNotification(admin, created);

    return created;
  }

  private async createUserAuditLog(
    tx: Prisma.TransactionClient,
    params: {
      actorUserId: string;
      targetUserId: string;
      action: AuditAction;
      before: UserAuditSnapshot;
      after: UserAuditSnapshot;
      fields?: UserAuditField[];
    },
  ) {
    const changes = buildUserChangesMeta(
      params.before,
      params.after,
      params.fields,
    );
    if (!Object.keys(changes).length) return;

    try {
      await tx.auditLog.create({
        data: {
          actorUserId: params.actorUserId,
          targetUserId: params.targetUserId,
          action: params.action,
          meta: {
            before: params.before,
            after: params.after,
            changes,
          },
        },
      });
    } catch (error) {
      // Permite continuar si la tabla de auditoría todavía no está migrada.
      if (isMissingAuditStorage(error)) return;
      throw error;
    }
  }

  private async sendPasswordSetupEmail(email: string) {
    const apiKey = getFirebaseWebApiKey();
    if (!apiKey) {
      throw new BadRequestException(
        'No se puede enviar email automático: falta FIREBASE_WEB_API_KEY',
      );
    }

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email,
        }),
      },
    );

    const payload = await res.json().catch(() => null);
    if (res.ok) return;

    const errorMessage =
      payload?.error?.message || 'No se pudo enviar el email de acceso';
    throw new BadRequestException(
      `No se pudo enviar email de acceso: ${errorMessage}`,
    );
  }

  private async buildAccessOnboarding(
    email: string,
    sendPasswordSetupEmail = true,
  ) {
    const firebaseApp = getFirebaseAdminApp();
    let passwordSetupEmailSent = false;
    let passwordSetupLink: string | null = null;
    let onboardingMessage = 'Usuario creado correctamente.';

    if (sendPasswordSetupEmail) {
      try {
        await this.sendPasswordSetupEmail(email);
        passwordSetupEmailSent = true;
        onboardingMessage =
          'Se ha enviado un email para establecer la contraseña.';
      } catch (emailError) {
        onboardingMessage =
          emailError instanceof Error
            ? emailError.message
            : 'No se pudo enviar el email automático.';
      }
    }

    if (!passwordSetupEmailSent) {
      try {
        passwordSetupLink = await firebaseApp
          .auth()
          .generatePasswordResetLink(email);
        onboardingMessage = sendPasswordSetupEmail
          ? `${onboardingMessage} Se generó un enlace manual para compartir con el usuario.`
          : 'Se generó un enlace manual para compartir con el usuario.';
      } catch {
        onboardingMessage = sendPasswordSetupEmail
          ? `${onboardingMessage} No se pudo generar enlace manual de respaldo.`
          : 'No se pudo generar enlace manual de contraseña.';
      }
    }

    return {
      passwordSetupEmailSent,
      passwordSetupLink,
      message: onboardingMessage,
    };
  }

  async weeklyCompany(firebaseUidAdmin: string, from: string, to: string) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    const fromDate = parseDateOnly(from);
    const toDate = parseDateOnly(to);
    if (toDate < fromDate)
      throw new BadRequestException('"to" debe ser >= "from"');

    const toExclusive = addDaysUTC(toDate, 1);

    const shifts = await this.prisma.shift.findMany({
      where: {
        startAt: { gte: fromDate, lt: toExclusive },
        endAt: { not: null },
        user: { companyId: admin.companyId },
      },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } }, // ✅ LOPD: sin firebaseUid
      },
      orderBy: { startAt: 'asc' },
    });

    const usersInRange = [...new Set(shifts.map((shift) => shift.userId))];
    const expectedByUser = await calculateExpectedWorkMinutes({
      prisma: this.prisma,
      companyId: admin.companyId,
      userIds: usersInRange,
      from: fromDate,
      toExclusive,
    });

    const perUser = new Map<
      string,
      {
        user: any;
        minutes: number;
        shiftsCount: number;
        expectedMinutes: number;
      }
    >();
    let totalMinutes = 0;
    let totalExpectedMinutes = 0;

    for (const s of shifts) {
      const start = new Date(s.startAt);
      const end = new Date(s.endAt!);

      const diffMs = end.getTime() - start.getTime();
      const minutes = diffMs > 0 ? Math.ceil(diffMs / 60000) : 0;

      totalMinutes += minutes;

      const key = s.userId;
      const current = perUser.get(key) ?? {
        user: s.user,
        minutes: 0,
        shiftsCount: 0,
        expectedMinutes: expectedByUser.get(key) ?? 0,
      };
      current.minutes += minutes;
      current.shiftsCount += 1;
      perUser.set(key, current);
    }

    totalExpectedMinutes = [...expectedByUser.values()].reduce(
      (acc, value) => acc + value,
      0,
    );

    const users = Array.from(perUser.values())
      .map((x) => ({
        user: x.user,
        totalMinutes: x.minutes,
        totalHours: Number((x.minutes / 60).toFixed(2)),
        expectedMinutes: x.expectedMinutes,
        expectedHours: Number((x.expectedMinutes / 60).toFixed(2)),
        balanceHours: Number(((x.minutes - x.expectedMinutes) / 60).toFixed(2)),
        shiftsCount: x.shiftsCount,
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);

    return {
      from,
      to,
      companyTotalMinutes: totalMinutes,
      companyTotalHours: Number((totalMinutes / 60).toFixed(2)),
      companyExpectedMinutes: totalExpectedMinutes,
      companyExpectedHours: Number((totalExpectedMinutes / 60).toFixed(2)),
      companyBalanceHours: Number(
        ((totalMinutes - totalExpectedMinutes) / 60).toFixed(2),
      ),
      users,
    };
  }

  async getRequests(
    firebaseUidAdmin: string,
    status?: string,
    type?: string,
    source?: string,
  ) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    return this.prisma.request.findMany({
      where: {
        user: { companyId: admin.companyId },
        ...(status ? { status: status as any } : {}),
        ...(type ? { type: type as any } : {}),
        ...(source ? { source: source as any } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRequestById(firebaseUidAdmin: string, id: string) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    const request = await this.prisma.request.findFirst({
      where: { id, user: { companyId: admin.companyId } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!request) throw new NotFoundException('Solicitud no encontrada');
    return request;
  }

  async dashboard(firebaseUidAdmin: string) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setUTCDate(weekStart.getUTCDate() - 7);
    const todayStart = DateTime.now()
      .setZone('Europe/Madrid')
      .startOf('day')
      .toUTC()
      .toJSDate();
    const todayEnd = DateTime.now()
      .setZone('Europe/Madrid')
      .plus({ days: 1 })
      .startOf('day')
      .toUTC()
      .toJSDate();

    const [
      totalEmployees,
      totalInterns,
      shifts,
      pendingRequests,
      pendingVacationRequests,
      pendingCorrectionRequests,
      pendingOvertimeRequests,
      openShifts,
      suspiciousOpenWeek,
      todayScheduleSummary,
    ] = await Promise.all([
      this.prisma.user.count({
        where: {
          role: 'EMPLOYEE',
          companyId: admin.companyId,
        },
      }),
      this.prisma.user.count({
        where: {
          companyId: admin.companyId,
          workerGroup: 'INTERN',
        },
      }),
      this.prisma.shift.findMany({
        where: {
          user: { companyId: admin.companyId },
          startAt: { gte: weekStart },
          endAt: { not: null },
        },
        select: { startAt: true, endAt: true },
      }),
      this.prisma.request.count({
        where: {
          status: 'PENDING',
          user: { companyId: admin.companyId },
        },
      }),
      this.prisma.request.count({
        where: {
          status: 'PENDING',
          type: 'VACATION',
          user: { companyId: admin.companyId },
        },
      }),
      this.prisma.request.count({
        where: {
          status: 'PENDING',
          type: 'CORRECTION',
          user: { companyId: admin.companyId },
        },
      }),
      this.prisma.request.count({
        where: {
          status: 'PENDING',
          type: 'OVERTIME',
          user: { companyId: admin.companyId },
        },
      }),
      this.prisma.shift.count({
        where: {
          endAt: null,
          user: { companyId: admin.companyId },
        },
      }),
      this.prisma.shift.count({
        where: {
          isSuspicious: true,
          startAt: { gte: weekStart },
          user: { companyId: admin.companyId },
        },
      }),
      this.prisma.scheduleEntry.groupBy({
        by: ['type'],
        where: {
          user: { companyId: admin.companyId },
          date: { gte: todayStart, lt: todayEnd },
        },
        _count: {
          type: true,
        },
      }),
    ]);

    const totalMinutesWeek = shifts.reduce((acc, s) => {
      if (!s.endAt) return acc;
      const diff = new Date(s.endAt).getTime() - new Date(s.startAt).getTime();
      return acc + (diff > 0 ? Math.ceil(diff / 60000) : 0);
    }, 0);

    return {
      totalEmployees,
      totalInterns,
      totalHoursWeek: Number((totalMinutesWeek / 60).toFixed(2)),
      pendingRequests,
      pendingVacationRequests,
      pendingCorrectionRequests,
      pendingOvertimeRequests,
      openShifts,
      suspiciousShiftsWeek: suspiciousOpenWeek,
      onVacationToday:
        todayScheduleSummary.find((item) => item.type === 'VACATION')?._count
          .type ?? 0,
      onSickLeaveToday:
        todayScheduleSummary.find((item) => item.type === 'SICK_LEAVE')?._count
          .type ?? 0,
      onDayOffToday:
        todayScheduleSummary.find((item) => item.type === 'DAY_OFF')?._count
          .type ?? 0,
    };
  }

  async todayShifts(firebaseUidAdmin: string) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);
    const timezone = 'Europe/Madrid';
    const startOfDay = DateTime.now()
      .setZone(timezone)
      .startOf('day')
      .toUTC()
      .toJSDate();
    const endOfDay = DateTime.now()
      .setZone(timezone)
      .plus({ days: 1 })
      .startOf('day')
      .toUTC()
      .toJSDate();

    const shifts = await this.prisma.shift.findMany({
      where: {
        user: {
          companyId: admin.companyId,
          role: 'EMPLOYEE',
        },
        startAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
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
            workerGroup: true,
          },
        },
      },
      orderBy: [{ startAt: 'desc' }, { user: { name: 'asc' } }],
    });

    return shifts.map((shift) => {
      return {
        id: shift.id,
        userId: shift.user.id,
        name: shift.user.name,
        email: shift.user.email,
        workerGroup: shift.user.workerGroup,
        isWorking: !shift.endAt,
        startAt: shift.startAt,
        endAt: shift.endAt,
        startLat: shift.startLat,
        startLng: shift.startLng,
        startAddress: shift.startAddress,
        endLat: shift.endLat,
        endLng: shift.endLng,
        endAddress: shift.endAddress,
        workplace: shift.workplace,
      };
    });
  }

  async getBackupStatus(firebaseUidAdmin: string) {
    await this.getAdminForAudit(firebaseUidAdmin);

    const latestFile = this.scanLatestBackupFile();
    const latestFromDisk = latestFile
      ? {
          fileName: latestFile.name,
          sizeBytes: latestFile.sizeBytes,
          finishedAt: new Date(latestFile.mtimeMs).toISOString(),
        }
      : null;

    return {
      autoBackupEnabled: this.autoBackupEnabled,
      autoBackupIntervalHours: this.autoBackupIntervalHours,
      backupRetentionDays: this.backupRetentionDays,
      nextAutoBackupAt: this.nextAutoBackupAt?.toISOString() || null,
      backupInProgress: this.backupInProgress,
      lastBackup: this.lastBackup
        ? {
            fileName: this.lastBackup.fileName,
            sizeBytes: this.lastBackup.sizeBytes,
            finishedAt: this.lastBackup.finishedAt,
            trigger: this.lastBackup.trigger,
          }
        : latestFromDisk,
      lastBackupError: this.lastBackupError,
      backupDir: this.backupDir,
    };
  }

  async getProductionStatus(firebaseUidAdmin: string) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);
    const databaseUrl = cleanEnv('DATABASE_URL');
    const nodeEnv = cleanEnv('NODE_ENV') || 'development';
    const corsAllowlist = cleanEnv('CORS_ORIGIN_ALLOWLIST') || cleanEnv('CORS_ORIGINS');
    const mailEnabled = envEnabled('MAIL_ENABLED', false);
    const turnstileEnabled = envEnabled('TURNSTILE_ENABLED', false);
    const openClawEnabled = envEnabled('OPENCLAW_ENABLED', false);
    const latestBackupFile = this.scanLatestBackupFile();

    let migrationInfo: {
      count: number;
      latestFinishedAt: Date | null;
    } | null = null;
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{ count: number; latestFinishedAt: Date | null }>
      >`
        SELECT COUNT(*)::int AS count, MAX(finished_at) AS "latestFinishedAt"
        FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL
      `;
      migrationInfo = rows[0] ?? null;
    } catch {
      migrationInfo = null;
    }

    const openClawIntegration = await this.prisma.agentIntegration.findUnique({
      where: {
        companyId_provider: {
          companyId: admin.companyId,
          provider: 'OPENCLAW',
        },
      },
      select: {
        isEnabled: true,
        tokenPreview: true,
        lastUsedAt: true,
      },
    });

    const items = [
      {
        key: 'node-env',
        label: 'Modo de ejecución',
        status: nodeEnv === 'production' ? 'ok' : 'warning',
        detail:
          nodeEnv === 'production'
            ? 'NODE_ENV está en production.'
            : `Actualmente está en ${nodeEnv}. En despliegue real debe ser production.`,
      },
      {
        key: 'database-url',
        label: 'Base de datos PostgreSQL',
        status: !databaseUrl
          ? 'missing'
          : isLocalDatabaseUrl(databaseUrl)
            ? 'warning'
            : 'ok',
        detail: !databaseUrl
          ? 'Falta DATABASE_URL.'
          : isLocalDatabaseUrl(databaseUrl)
            ? 'DATABASE_URL apunta a entorno local. En producción debe apuntar al proveedor real.'
            : 'DATABASE_URL está configurada para un host no local.',
      },
      {
        key: 'prisma-migrations',
        label: 'Migraciones Prisma',
        status: migrationInfo?.count ? 'ok' : 'missing',
        detail: migrationInfo?.count
          ? `${migrationInfo.count} migraciones aplicadas. Última: ${
              migrationInfo.latestFinishedAt
                ? migrationInfo.latestFinishedAt.toISOString()
                : 'sin fecha'
            }.`
          : 'No se pudo confirmar el estado de migraciones.',
      },
      {
        key: 'firebase',
        label: 'Firebase definitivo',
        status:
          hasRealEnvValue('FIREBASE_WEB_API_KEY') &&
          hasRealEnvValue('FIREBASE_PROJECT_ID')
            ? 'ok'
            : 'missing',
        detail:
          hasRealEnvValue('FIREBASE_WEB_API_KEY') &&
          hasRealEnvValue('FIREBASE_PROJECT_ID')
            ? 'Firebase web API key y project id configurados.'
            : 'Faltan FIREBASE_WEB_API_KEY y/o FIREBASE_PROJECT_ID.',
      },
      {
        key: 'cors',
        label: 'Dominio frontend / CORS',
        status: corsAllowlist && !corsAllowlist.includes('tu-dominio')
          ? 'ok'
          : 'missing',
        detail: corsAllowlist && !corsAllowlist.includes('tu-dominio')
          ? 'CORS_ORIGIN_ALLOWLIST tiene dominios configurados.'
          : 'Falta configurar CORS_ORIGIN_ALLOWLIST con el dominio real.',
      },
      {
        key: 'smtp',
        label: 'Correo SMTP',
        status: !mailEnabled
          ? 'disabled'
          : hasRealEnvValue('MAIL_FROM') &&
              hasRealEnvValue('SMTP_HOST') &&
              hasRealEnvValue('SMTP_USER') &&
              hasRealEnvValue('SMTP_PASS')
            ? 'ok'
            : 'missing',
        detail: !mailEnabled
          ? 'MAIL_ENABLED=false. Correos desactivados.'
          : 'MAIL_ENABLED=true. Revisa MAIL_FROM, SMTP_HOST, SMTP_USER y SMTP_PASS.',
      },
      {
        key: 'turnstile',
        label: 'CAPTCHA Turnstile',
        status: !turnstileEnabled
          ? 'disabled'
          : hasRealEnvValue('TURNSTILE_SITE_KEY') &&
              hasRealEnvValue('TURNSTILE_SECRET_KEY')
            ? 'ok'
            : 'missing',
        detail: !turnstileEnabled
          ? 'TURNSTILE_ENABLED=false. Registro público sin CAPTCHA activo.'
          : 'Turnstile activado. Deben existir site key y secret key reales.',
      },
      {
        key: 'openclaw',
        label: 'OpenClaw',
        status: !openClawEnabled
          ? 'disabled'
          : openClawIntegration?.isEnabled && openClawIntegration.tokenPreview
            ? 'ok'
            : 'warning',
        detail: !openClawEnabled
          ? 'OPENCLAW_ENABLED=false. Integración desactivada.'
          : openClawIntegration?.isEnabled && openClawIntegration.tokenPreview
            ? `Token activo para esta empresa (${openClawIntegration.tokenPreview}).`
            : 'OpenClaw está activado globalmente, pero esta empresa no tiene token activo.',
      },
      {
        key: 'backups',
        label: 'Backups automáticos',
        status: this.autoBackupEnabled
          ? latestBackupFile
            ? 'ok'
            : 'warning'
          : 'disabled',
        detail: this.autoBackupEnabled
          ? latestBackupFile
            ? `Activo cada ${this.autoBackupIntervalHours}h. Último backup: ${latestBackupFile.name}.`
            : `Activo cada ${this.autoBackupIntervalHours}h, pero todavía no hay backup detectado.`
          : 'AUTO_BACKUP_ENABLED=false. Backups automáticos desactivados.',
      },
      {
        key: 'secrets',
        label: 'Secretos y repositorio',
        status: 'warning',
        detail:
          'Comprobación manual: confirmar que .env, tokens y backups no se suben a GitHub.',
      },
    ];

    const blockingCount = items.filter((item) => item.status === 'missing').length;
    const warningCount = items.filter((item) => item.status === 'warning').length;
    const okCount = items.filter((item) => item.status === 'ok').length;

    return {
      generatedAt: new Date().toISOString(),
      environment: nodeEnv,
      overallStatus:
        blockingCount > 0
          ? 'pending'
          : warningCount > 0
            ? 'review'
            : 'ready',
      summary: {
        ok: okCount,
        warnings: warningCount,
        pending: blockingCount,
        disabled: items.filter((item) => item.status === 'disabled').length,
      },
      items,
    };
  }

  async runBackupNow(firebaseUidAdmin: string) {
    await this.getAdminForAudit(firebaseUidAdmin);
    const snapshot = await this.runBackup('MANUAL');
    return {
      ok: true,
      message: 'Backup generado correctamente.',
      backup: {
        fileName: snapshot.fileName,
        sizeBytes: snapshot.sizeBytes,
        finishedAt: snapshot.finishedAt,
        trigger: snapshot.trigger,
      },
    };
  }

  async sendTestEmail(firebaseUidAdmin: string, dto: SendTestEmailDto) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);
    const company = await this.prisma.company.findUnique({
      where: { id: admin.companyId },
      select: {
        id: true,
        name: true,
      },
    });

    const recipient = dto.email?.trim() || admin.email?.trim() || '';
    if (!recipient) {
      throw new BadRequestException(
        'Indica un email de destino o guarda un correo válido en tu perfil.',
      );
    }

    const companyName = company?.name?.trim() || 'tu empresa';
    const adminName = this.formatActorName(admin);
    const sentAt = DateTime.now()
      .setZone('Europe/Madrid')
      .toFormat('dd/LL/yyyy HH:mm');

    const text = [
      `Hola,`,
      '',
      `Este es un correo de prueba de Fichaje para ${companyName}.`,
      `Lo ha lanzado: ${adminName}.`,
      `Fecha y hora: ${sentAt}.`,
      '',
      'Si has recibido este mensaje, la configuración SMTP está funcionando correctamente.',
    ].join('\n');

    try {
      const result = await this.mailService.sendTextEmail(
        recipient,
        `Correo de prueba · ${companyName}`,
        text,
      );

      return {
        ok: true,
        recipient,
        ...result,
        message: result.sent
          ? 'Correo de prueba enviado correctamente.'
          : result.reason === 'disabled'
            ? 'El correo está desactivado en la configuración.'
            : result.reason === 'missing-config'
              ? 'Falta completar la configuración SMTP.'
              : 'No se ha enviado el correo de prueba.',
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new InternalServerErrorException(
        `No se pudo enviar el correo de prueba: ${message}`,
      );
    }
  }

  async getWorkplace(firebaseUidAdmin: string) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    const workplace = await this.prisma.workplace.findFirst({
      where: { companyId: admin.companyId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: workplaceSelect,
    });

    return {
      configured: !!workplace,
      workplace,
    };
  }

  async listWorkplaces(firebaseUidAdmin: string) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    return this.prisma.workplace.findMany({
      where: { companyId: admin.companyId },
      select: workplaceSelect,
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async setWorkplace(firebaseUidAdmin: string, dto: SetWorkplaceDto) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    const primary = await this.prisma.workplace.findFirst({
      where: { companyId: admin.companyId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    });

    return this.upsertWorkplace(firebaseUidAdmin, {
      id: primary?.id,
      name: dto.name,
      lat: dto.lat,
      lng: dto.lng,
      radiusMeters: dto.radiusMeters,
      maxAllowedAccuracy: dto.maxAllowedAccuracy,
      strictMode: dto.strictMode,
      isPrimary: true,
      isActive: true,
    });
  }

  async upsertWorkplace(firebaseUidAdmin: string, dto: UpsertWorkplaceDto) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);
    const radiusMeters = Math.max(1, Math.round(dto.radiusMeters));
    const maxAllowedAccuracy =
      dto.maxAllowedAccuracy != null ? Number(dto.maxAllowedAccuracy) : null;
    const strictMode = dto.strictMode === true;
    const isPrimary = dto.isPrimary === true;
    const isActive = dto.isActive !== false;
    const data = {
      name: normalizeOptionalText(dto.name),
      addressLabel: normalizeOptionalText(dto.addressLabel),
      country: normalizeOptionalText(dto.country),
      region: normalizeOptionalText(dto.region),
      province: normalizeOptionalText(dto.province),
      municipality: normalizeOptionalText(dto.municipality),
      postalCode: normalizeOptionalText(dto.postalCode),
      lat: dto.lat,
      lng: dto.lng,
      radiusMeters,
      maxAllowedAccuracy,
      strictMode,
      isPrimary,
      isActive,
    };

    if (dto.id) {
      const existing = await this.prisma.workplace.findFirst({
        where: { id: dto.id, companyId: admin.companyId },
        select: { id: true },
      });
      if (!existing) {
        throw new NotFoundException('Centro de trabajo no encontrado');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.workplace.updateMany({
          where: {
            companyId: admin.companyId,
            ...(dto.id ? { id: { not: dto.id } } : {}),
          },
          data: { isPrimary: false },
        });
      }

      const workplace = dto.id
        ? await tx.workplace.update({
            where: { id: dto.id },
            data,
            select: workplaceSelect,
          })
        : await tx.workplace.create({
            data: {
              companyId: admin.companyId,
              ...data,
            },
            select: workplaceSelect,
          });

      if (!isPrimary) {
        const hasPrimary = await tx.workplace.findFirst({
          where: { companyId: admin.companyId, isPrimary: true },
          select: { id: true },
        });
        if (!hasPrimary) {
          return tx.workplace.update({
            where: { id: workplace.id },
            data: { isPrimary: true },
            select: workplaceSelect,
          });
        }
      }

      return workplace;
    });
  }

  async deleteWorkplace(firebaseUidAdmin: string, id: string) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);
    const workplace = await this.prisma.workplace.findFirst({
      where: { id, companyId: admin.companyId },
      select: { id: true, isPrimary: true },
    });
    if (!workplace) {
      throw new NotFoundException('Centro de trabajo no encontrado');
    }

    const count = await this.prisma.workplace.count({
      where: { companyId: admin.companyId },
    });
    if (count <= 1) {
      throw new BadRequestException(
        'Debe existir al menos un centro de trabajo configurado',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.workplace.delete({
        where: { id: workplace.id },
      });

      if (workplace.isPrimary) {
        const fallback = await tx.workplace.findFirst({
          where: { companyId: admin.companyId },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (fallback) {
          await tx.workplace.update({
            where: { id: fallback.id },
            data: { isPrimary: true },
          });
        }
      }

      return { deleted: true };
    });
  }

  async getCompanyLocation(firebaseUidAdmin: string) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    const company = await this.prisma.company.findUnique({
      where: { id: admin.companyId },
      select: {
        id: true,
        code: true,
        name: true,
        country: true,
        region: true,
        province: true,
        municipality: true,
        postalCode: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    return company;
  }

  async setCompanyLocation(
    firebaseUidAdmin: string,
    dto: UpdateCompanyLocationDto,
  ) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    return this.prisma.company.update({
      where: { id: admin.companyId },
      data: {
        country: normalizeOptionalText(dto.country),
        region: normalizeOptionalText(dto.region),
        province: normalizeOptionalText(dto.province),
        municipality: normalizeOptionalText(dto.municipality),
        postalCode: normalizeOptionalText(dto.postalCode),
      },
      select: {
        id: true,
        code: true,
        name: true,
        country: true,
        region: true,
        province: true,
        municipality: true,
        postalCode: true,
      },
    });
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'user-agent': 'api-fichar/1.0',
        },
      });

      if (!response.ok) {
        throw new InternalServerErrorException(
          `No se pudo consultar la fuente oficial (${response.status})`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error consultando fuente oficial de festivos ${url}`,
        error,
      );
      throw new InternalServerErrorException(
        'No se pudo consultar la fuente oficial de festivos',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async loadMadridOfficialHolidays(
    year: number,
    municipality: string,
  ): Promise<
    Array<{
      date: string;
      name: string;
      scope: 'NATIONAL' | 'REGIONAL' | 'LOCAL';
      country: string;
      region: string;
      province: string;
      municipality: string | null;
      notes: string;
    }>
  > {
    const [regionalDataset, localDataset] = await Promise.all([
      this.fetchJson<MadridDatasetResponse<MadridRegionalHolidayItem>>(
        MADRID_REGIONAL_HOLIDAYS_URL,
      ),
      this.fetchJson<MadridDatasetResponse<MadridLocalHolidayItem>>(
        MADRID_LOCAL_HOLIDAYS_URL,
      ),
    ]);

    const municipalityKey = normalizeMatchText(municipality);
    const imported = new Map<
      string,
      {
        date: string;
        name: string;
        scope: 'NATIONAL' | 'REGIONAL' | 'LOCAL';
        country: string;
        region: string;
        province: string;
        municipality: string | null;
        notes: string;
      }
    >();

    for (const item of regionalDataset.data ?? []) {
      if (String(item.año ?? '') !== String(year)) continue;
      const date = String(item.fecha_festivo ?? '').trim();
      const name = String(item.festividad ?? '').trim();
      if (!date || !name) continue;

      const scope = classifyMadridHolidayScope(name);
      imported.set(`${date}|${scope}|${normalizeMatchText(name)}`, {
        date,
        name,
        scope,
        country: SPAIN_COUNTRY_NAME,
        region: MADRID_REGION_NAME,
        province: MADRID_PROVINCE_NAME,
        municipality: null,
        notes:
          'Importado automáticamente desde datos abiertos oficiales de la Comunidad de Madrid.',
      });
    }

    let localMatches = 0;
    for (const item of localDataset.data ?? []) {
      if (String(item.año ?? '') !== String(year)) continue;
      const municipalityName = String(
        item.municipio_nombre ?? item.entidad_nombre ?? '',
      ).trim();
      const date = String(item.fecha_festivo ?? '').trim();
      if (!date || !municipalityName) continue;
      if (normalizeMatchText(municipalityName) !== municipalityKey) continue;

      localMatches += 1;
      const localName = `Festivo local de ${municipalityName}`;
      imported.set(`${date}|LOCAL|${normalizeMatchText(localName)}`, {
        date,
        name: localName,
        scope: 'LOCAL',
        country: SPAIN_COUNTRY_NAME,
        region: MADRID_REGION_NAME,
        province: MADRID_PROVINCE_NAME,
        municipality: municipalityName,
        notes:
          'Importado automáticamente desde datos abiertos oficiales de la Comunidad de Madrid.',
      });
    }

    const values = [...imported.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    if (!values.length) {
      throw new BadRequestException(
        `No se encontraron festivos oficiales para ${year}.`,
      );
    }

    if (!localMatches) {
      this.logger.warn(
        `No se encontraron festivos locales oficiales para el municipio ${municipality} en ${year}.`,
      );
    }

    return values;
  }

  async importOfficialHolidays(
    firebaseUidAdmin: string,
    dto: ImportOfficialHolidaysDto,
  ) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);
    const company = await this.getCompanyLocation(firebaseUidAdmin);
    const year: number =
      typeof dto.year === 'number' && Number.isInteger(dto.year)
        ? dto.year
        : DateTime.now().setZone('Europe/Madrid').year;

    const municipality = normalizeOptionalText(company.municipality);
    if (!municipality) {
      throw new BadRequestException(
        'Primero debes guardar el municipio de la empresa.',
      );
    }

    const regionKey = normalizeMatchText(company.region);
    const provinceKey = normalizeMatchText(company.province);
    const isMadrid =
      regionKey.includes('madrid') || provinceKey.includes('madrid');

    if (!isMadrid) {
      throw new BadRequestException(
        'La importación automática oficial está disponible de momento para empresas ubicadas en la Comunidad de Madrid.',
      );
    }

    const importedCandidates = await this.loadMadridOfficialHolidays(
      year,
      municipality,
    );

    const yearStart = parseDateOnly(`${year}-01-01`);
    const yearEnd = parseDateOnly(`${year + 1}-01-01`);
    const existing = await this.prisma.holiday.findMany({
      where: {
        companyId: admin.companyId,
        date: {
          gte: yearStart,
          lt: yearEnd,
        },
      },
      select: {
        id: true,
        date: true,
        name: true,
        scope: true,
      },
    });

    const existingKeys = new Set(
      existing.map(
        (holiday) =>
          `${DateTime.fromJSDate(holiday.date).toUTC().toFormat('yyyy-LL-dd')}|${holiday.scope}|${normalizeMatchText(holiday.name)}`,
      ),
    );

    const toCreate = importedCandidates.filter((holiday) => {
      const key = `${holiday.date}|${holiday.scope}|${normalizeMatchText(holiday.name)}`;
      return !existingKeys.has(key);
    });

    if (toCreate.length) {
      await this.prisma.holiday.createMany({
        data: toCreate.map((holiday) => ({
          companyId: admin.companyId,
          date: parseDateOnly(holiday.date),
          name: holiday.name,
          scope: holiday.scope,
          country: holiday.country,
          region: holiday.region,
          province: holiday.province,
          municipality: holiday.municipality,
          notes: holiday.notes,
        })),
      });
    }

    return {
      year,
      municipality,
      imported: toCreate.length,
      skipped: importedCandidates.length - toCreate.length,
      totalOfficialFound: importedCandidates.length,
      source: 'Comunidad de Madrid',
      warning:
        importedCandidates.filter((holiday) => holiday.scope === 'LOCAL')
          .length > 0
          ? null
          : `No se han encontrado festivos locales oficiales para ${municipality} en ${year}. Se han importado solo los autonómicos y nacionales.`,
    };
  }

  async listHolidays(firebaseUidAdmin: string, from?: string, to?: string) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    let dateFilter:
      | {
          gte?: Date;
          lt?: Date;
        }
      | undefined;

    if (from || to) {
      const fromDate = from ? parseDateOnly(from) : undefined;
      const toDate = to ? parseDateOnly(to) : undefined;
      if (fromDate && toDate && toDate < fromDate) {
        throw new BadRequestException('"to" debe ser >= "from"');
      }
      dateFilter = {};
      if (fromDate) dateFilter.gte = fromDate;
      if (toDate) dateFilter.lt = addDaysUTC(toDate, 1);
    }

    return this.prisma.holiday.findMany({
      where: {
        companyId: admin.companyId,
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      select: {
        id: true,
        date: true,
        name: true,
        scope: true,
        country: true,
        region: true,
        province: true,
        municipality: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ date: 'asc' }, { name: 'asc' }],
    });
  }

  async createHoliday(firebaseUidAdmin: string, dto: CreateHolidayDto) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);
    const company = await this.getCompanyLocation(firebaseUidAdmin);
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException('El nombre del festivo es obligatorio');
    }

    return this.prisma.holiday.create({
      data: {
        companyId: admin.companyId,
        date: parseDateOnly(dto.date),
        name,
        scope: dto.scope,
        country: normalizeOptionalText(dto.country) ?? company.country ?? null,
        region: normalizeOptionalText(dto.region) ?? company.region ?? null,
        province:
          normalizeOptionalText(dto.province) ?? company.province ?? null,
        municipality:
          normalizeOptionalText(dto.municipality) ??
          company.municipality ??
          null,
        notes: normalizeOptionalText(dto.notes),
      },
      select: {
        id: true,
        date: true,
        name: true,
        scope: true,
        country: true,
        region: true,
        province: true,
        municipality: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateHoliday(
    firebaseUidAdmin: string,
    id: string,
    dto: UpdateHolidayDto,
  ) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);
    const holiday = await this.prisma.holiday.findFirst({
      where: { id, companyId: admin.companyId },
      select: { id: true },
    });

    if (!holiday) {
      throw new NotFoundException('Festivo no encontrado');
    }

    const company = await this.getCompanyLocation(firebaseUidAdmin);
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException('El nombre del festivo es obligatorio');
    }

    return this.prisma.holiday.update({
      where: { id: holiday.id },
      data: {
        date: parseDateOnly(dto.date),
        name,
        scope: dto.scope,
        country: normalizeOptionalText(dto.country) ?? company.country ?? null,
        region: normalizeOptionalText(dto.region) ?? company.region ?? null,
        province:
          normalizeOptionalText(dto.province) ?? company.province ?? null,
        municipality:
          normalizeOptionalText(dto.municipality) ??
          company.municipality ??
          null,
        notes: normalizeOptionalText(dto.notes),
      },
      select: {
        id: true,
        date: true,
        name: true,
        scope: true,
        country: true,
        region: true,
        province: true,
        municipality: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteHoliday(firebaseUidAdmin: string, id: string) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    const deleted = await this.prisma.holiday.deleteMany({
      where: {
        id,
        companyId: admin.companyId,
      },
    });

    if (!deleted.count) {
      throw new NotFoundException('Festivo no encontrado');
    }

    return { ok: true, deleted: deleted.count };
  }

  async suspiciousShifts(
    firebaseUidAdmin: string,
    from?: string,
    to?: string,
    limitRaw?: string,
  ) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);
    const parsedLimit = Number(limitRaw ?? '100');
    const take = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 300)
      : 100;

    let startAtFilter:
      | {
          gte?: Date;
          lt?: Date;
        }
      | undefined;
    if (from || to) {
      const fromDate = from ? parseDateOnly(from) : undefined;
      const toDate = to ? parseDateOnly(to) : undefined;
      if (fromDate && toDate && toDate < fromDate) {
        throw new BadRequestException('"to" debe ser >= "from"');
      }
      startAtFilter = {};
      if (fromDate) startAtFilter.gte = fromDate;
      if (toDate) startAtFilter.lt = addDaysUTC(toDate, 1);
    }

    const shifts = await this.prisma.shift.findMany({
      where: {
        isSuspicious: true,
        user: { companyId: admin.companyId },
        ...(startAtFilter ? { startAt: startAtFilter } : {}),
      },
      orderBy: { startAt: 'desc' },
      take,
      select: {
        id: true,
        userId: true,
        startAt: true,
        endAt: true,
        startLat: true,
        startLng: true,
        startAddress: true,
        endLat: true,
        endLng: true,
        endAddress: true,
        accuracy: true,
        startDistanceMeters: true,
        endDistanceMeters: true,
        startInsideGeofence: true,
        endInsideGeofence: true,
        riskScore: true,
        riskReasons: true,
        startIp: true,
        endIp: true,
        startUserAgent: true,
        endUserAgent: true,
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

    return shifts.map((shift) => ({
      ...shift,
      riskReasons: Array.isArray(shift.riskReasons)
        ? shift.riskReasons.filter((item) => typeof item === 'string')
        : [],
    }));
  }

  async auditLogs(
    firebaseUidAdmin: string,
    targetUserId?: string,
    limitRaw?: string,
  ) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    const parsedLimit = Number(limitRaw ?? '50');
    const take = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 200)
      : 50;

    if (targetUserId) {
      const targetExists = await this.prisma.user.findFirst({
        where: {
          id: targetUserId,
          companyId: admin.companyId,
        },
        select: { id: true },
      });
      if (!targetExists) throw new NotFoundException('Usuario no encontrado');
    }

    try {
      return await this.prisma.auditLog.findMany({
        where: {
          targetUser: {
            companyId: admin.companyId,
            ...(targetUserId ? { id: targetUserId } : {}),
          },
        },
        include: {
          actorUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          targetUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
      });
    } catch (error) {
      if (isMissingAuditStorage(error)) return [];
      throw error;
    }
  }

  async users(firebaseUidAdmin: string) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);
    const users = await this.prisma.user.findMany({
      where: {
        companyId: admin.companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        birthDate: true,
        role: true,
        workerGroup: true,
        internshipTotalHours: true,
        vacationAllowanceDays: true,
        overtimeBankMinutesAdjustment: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const yearStart = new Date(
      Date.UTC(new Date().getUTCFullYear(), 0, 1, 0, 0, 0),
    );
    const yearEnd = new Date(
      Date.UTC(new Date().getUTCFullYear() + 1, 0, 1, 0, 0, 0),
    );

    return Promise.all(
      users.map(async (user) => {
        const [vacationUsage, overtimeUsage] = await Promise.all([
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

        const vacationAllowanceDays =
          user.vacationAllowanceDays ??
          Number(process.env.DEFAULT_VACATION_ALLOWANCE_DAYS ?? '22');
        const overtimeBankMinutes =
          overtimeUsage.approvedMinutes + user.overtimeBankMinutesAdjustment;

        return {
          ...user,
          vacationBalance: {
            allowanceDays: vacationAllowanceDays,
            approvedDays: vacationUsage.approvedDays,
            pendingDays: vacationUsage.pendingDays,
            availableDays: Number(
              Math.max(
                0,
                vacationAllowanceDays - vacationUsage.approvedDays,
              ).toFixed(2),
            ),
          },
          overtimeBank: {
            approvedHours: Number(
              (overtimeUsage.approvedMinutes / 60).toFixed(2),
            ),
            pendingHours: Number(
              (overtimeUsage.pendingMinutes / 60).toFixed(2),
            ),
            adjustmentHours: Number(
              (user.overtimeBankMinutesAdjustment / 60).toFixed(2),
            ),
            balanceHours: Number((overtimeBankMinutes / 60).toFixed(2)),
          },
        };
      }),
    );
  }

  async getUserProfile(firebaseUidAdmin: string, id: string) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    const user = await this.prisma.user.findFirst({
      where: {
        id,
        companyId: admin.companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        birthDate: true,
        role: true,
        workerGroup: true,
        internshipTotalHours: true,
        vacationAllowanceDays: true,
        overtimeBankMinutesAdjustment: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async deleteUser(firebaseUidAdmin: string, id: string) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    const target = await this.prisma.user.findFirst({
      where: { id, companyId: admin.companyId },
      select: {
        id: true,
        role: true,
        companyId: true,
        firebaseUid: true,
      },
    });
    if (!target) throw new NotFoundException('Usuario no encontrado');

    if (target.role === 'ADMIN') {
      const totalAdmins = await this.prisma.user.count({
        where: { companyId: admin.companyId, role: 'ADMIN' },
      });
      if (totalAdmins <= 1) {
        throw new BadRequestException('Debe existir al menos un administrador');
      }
    }

    const firebaseApp = getFirebaseAdminApp();
    try {
      await firebaseApp.auth().deleteUser(target.firebaseUid);
    } catch (error) {
      if (!hasFirebaseErrorCode(error, 'auth/user-not-found')) {
        throw new BadRequestException(
          'No se pudo eliminar la cuenta del usuario en Firebase',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.request.updateMany({
        where: { reviewedById: target.id },
        data: { reviewedById: null },
      });

      const deleted = await tx.user.deleteMany({
        where: { id: target.id, companyId: admin.companyId },
      });
      if (deleted.count !== 1) {
        throw new NotFoundException('Usuario no encontrado');
      }
    });

    return {
      deleted: true,
      id: target.id,
    };
  }

  private async createUserInCompany(
    adminCompanyId: string,
    dto: CreateAdminUserDto,
  ) {
    const email = dto.email.trim().toLowerCase();
    const name = dto.name?.trim() || null;
    const phone = normalizeInternationalPhone(dto.phone);
    const role = dto.role ?? 'EMPLOYEE';
    const workerGroup = dto.workerGroup ?? 'EMPLOYEE';
    const sendPasswordSetupEmail = dto.sendPasswordSetupEmail !== false;
    const internshipTotalHours =
      workerGroup === 'INTERN' ? (dto.internshipTotalHours ?? 0) : null;
    const vacationAllowanceDays =
      dto.vacationAllowanceDays ??
      Number(process.env.DEFAULT_VACATION_ALLOWANCE_DAYS ?? '22');
    const overtimeBankMinutesAdjustment =
      dto.overtimeBankMinutesAdjustment ?? 0;

    const existing = await this.prisma.user.findFirst({
      where: {
        companyId: adminCompanyId,
        email: { equals: email, mode: 'insensitive' },
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException('Ya existe un usuario con ese email');
    }

    if (phone) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { companyId: adminCompanyId, phone },
        select: { id: true },
      });
      if (existingPhone) {
        throw new BadRequestException('Ya existe un usuario con ese teléfono');
      }
    }

    const firebaseApp = getFirebaseAdminApp();
    let firebaseUid: string | null = null;
    let userCreatedInDb = false;

    try {
      const firebaseUser = await firebaseApp.auth().createUser({
        email,
        displayName: name ?? undefined,
      });

      firebaseUid = firebaseUser.uid;
      const createdUser = await this.prisma.user.create({
        data: {
          firebaseUid: firebaseUser.uid,
          companyId: adminCompanyId,
          email,
          name,
          phone,
          role,
          workerGroup,
          internshipTotalHours,
          vacationAllowanceDays,
          overtimeBankMinutesAdjustment,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          workerGroup: true,
          internshipTotalHours: true,
          vacationAllowanceDays: true,
          overtimeBankMinutesAdjustment: true,
          createdAt: true,
        },
      });

      userCreatedInDb = true;

      const onboarding = await this.buildAccessOnboarding(
        email,
        sendPasswordSetupEmail,
      );

      return {
        ...createdUser,
        onboarding,
      };
    } catch (error) {
      if (firebaseUid && !userCreatedInDb) {
        await firebaseApp
          .auth()
          .deleteUser(firebaseUid)
          .catch(() => undefined);
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException('Ya existe un usuario con esos datos');
        }
      }

      if (hasFirebaseErrorCode(error, 'auth/email-already-exists')) {
        throw new BadRequestException(
          'Ese email ya está registrado en Firebase',
        );
      }

      if (hasFirebaseErrorCode(error, 'auth/invalid-email')) {
        throw new BadRequestException('Email inválido');
      }
      throw error;
    }
  }

  async createUser(firebaseUidAdmin: string, dto: CreateAdminUserDto) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);
    return this.createUserInCompany(admin.companyId, dto);
  }

  async importUsersFromExcel(firebaseUidAdmin: string, fileBuffer: Buffer) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    if (!fileBuffer?.length) {
      throw new BadRequestException('Debes subir un archivo Excel válido');
    }

    const workbook = new ExcelJS.Workbook();

    try {
      const workbookLoader = workbook.xlsx as unknown as {
        load(data: unknown): Promise<void>;
      };
      await workbookLoader.load(fileBuffer);
    } catch {
      throw new BadRequestException(
        'No se pudo leer el Excel. Usa un archivo .xlsx válido',
      );
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('El Excel no contiene ninguna hoja');
    }

    const headerRow = worksheet.getRow(1);
    const headers = Array.from({ length: headerRow.cellCount }, (_, index) =>
      normalizeSpreadsheetHeader(
        excelCellToText(headerRow.getCell(index + 1).value),
      ),
    );

    const findHeaderIndex = (aliases: string[]) =>
      headers.findIndex((header) => aliases.includes(header)) + 1;

    const nameColumn = findHeaderIndex([
      'nombre',
      'nombre apellidos',
      'nombre y apellidos',
      'apellidos nombre',
      'full name',
      'name',
    ]);
    const emailColumn = findHeaderIndex([
      'correo',
      'correo electronico',
      'email',
      'e mail',
      'mail',
    ]);
    const phoneColumn = findHeaderIndex([
      'telefono',
      'telefono movil',
      'movil',
      'telefono movil contacto',
      'phone',
      'telefono contacto',
    ]);
    const roleColumn = findHeaderIndex([
      'rol',
      'role',
      'perfil',
      'tipo usuario',
    ]);
    const groupColumn = findHeaderIndex([
      'grupo',
      'group',
      'worker group',
      'grupo trabajo',
    ]);
    const internshipHoursColumn = findHeaderIndex([
      'horas practicas',
      'horas de practicas',
      'horas practicas opcional',
      'internship hours',
      'practice hours',
    ]);

    if (!emailColumn) {
      throw new BadRequestException(
        'El Excel debe incluir una columna de email o correo electrónico',
      );
    }

    const created: Array<{ row: number; name: string | null; email: string }> =
      [];
    const failed: Array<{ row: number; email: string; error: string }> = [];
    let skippedEmptyRows = 0;

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const email = excelCellToText(row.getCell(emailColumn).value)
        .trim()
        .toLowerCase();
      const name = nameColumn
        ? excelCellToText(row.getCell(nameColumn).value).trim()
        : '';
      const phone = phoneColumn
        ? excelCellToText(row.getCell(phoneColumn).value).trim()
        : '';
      const roleRaw = roleColumn
        ? excelCellToText(row.getCell(roleColumn).value).trim()
        : '';
      const groupRaw = groupColumn
        ? excelCellToText(row.getCell(groupColumn).value).trim()
        : '';
      const internshipHoursRaw = internshipHoursColumn
        ? excelCellToText(row.getCell(internshipHoursColumn).value).trim()
        : '';

      if (!email && !name && !phone && !roleRaw && !groupRaw && !internshipHoursRaw) {
        skippedEmptyRows += 1;
        continue;
      }

      if (!email) {
        failed.push({
          row: rowNumber,
          email: '',
          error: 'Falta el email',
        });
        continue;
      }

      try {
        const workerGroup = parseImportedWorkerGroup(groupRaw);
        const role = parseImportedRole(roleRaw);
        const internshipHoursParsed =
          workerGroup === 'INTERN' && internshipHoursRaw
            ? Number(internshipHoursRaw)
            : null;

        if (workerGroup === 'INTERN' && internshipHoursRaw) {
          if (
            internshipHoursParsed == null ||
            !Number.isFinite(internshipHoursParsed) ||
            internshipHoursParsed < 0
          ) {
            throw new BadRequestException(
              'Horas de prácticas inválidas. Usa un número igual o mayor que 0',
            );
          }
        }

        const result = await this.createUserInCompany(admin.companyId, {
          email,
          name: name || undefined,
          phone: phone || undefined,
          role,
          workerGroup,
          internshipTotalHours:
            workerGroup === 'INTERN'
              ? Math.trunc(internshipHoursParsed ?? 0)
              : undefined,
          sendPasswordSetupEmail: true,
        });

        created.push({
          row: rowNumber,
          name: result.name ?? null,
          email: result.email ?? email,
        });
      } catch (error) {
        failed.push({
          row: rowNumber,
          email,
          error: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    }

    return {
      sheetName: worksheet.name,
      totalRows: Math.max(0, worksheet.rowCount - 1),
      skippedEmptyRows,
      createdCount: created.length,
      failedCount: failed.length,
      created,
      failed,
    };
  }

  async generateUsersImportTemplate(firebaseUidAdmin: string) {
    await this.getAdminForAudit(firebaseUidAdmin);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'API Fichar';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.subject = 'Plantilla de importación de empleados';
    workbook.title = 'Plantilla altas masivas';
    workbook.company = 'App Fichar';

    const worksheet = workbook.addWorksheet('Empleados');
    worksheet.columns = [
      { header: 'Nombre y apellidos', key: 'name', width: 32 },
      { header: 'Correo electrónico', key: 'email', width: 34 },
      { header: 'Teléfono', key: 'phone', width: 20 },
      { header: 'Rol', key: 'role', width: 18 },
      { header: 'Grupo', key: 'workerGroup', width: 18 },
      { header: 'Horas de prácticas', key: 'internshipTotalHours', width: 18 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9EAF7' },
    };
    headerRow.alignment = { vertical: 'middle' };

    worksheet.addRow({
      name: 'Ejemplo Usuario',
      email: 'usuario@empresa.com',
      phone: '600123123',
      role: 'Trabajador',
      workerGroup: 'Trabajador',
      internshipTotalHours: '',
    });

    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.autoFilter = {
      from: 'A1',
      to: 'F1',
    };

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    return {
      buffer,
      filename: 'plantilla_importacion_empleados.xlsx',
    };
  }

  async generateUsersExportXlsx(firebaseUidAdmin: string) {
    const users = await this.users(firebaseUidAdmin);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'API Fichar';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.subject = 'Exportación de personal';
    workbook.title = 'Personal actual de la empresa';
    workbook.company = 'App Fichar';

    const worksheet = workbook.addWorksheet('Personal');
    worksheet.columns = [
      { header: 'Nombre y apellidos', key: 'name', width: 30 },
      { header: 'Correo electrónico', key: 'email', width: 32 },
      { header: 'Teléfono', key: 'phone', width: 18 },
      { header: 'Rol', key: 'role', width: 18 },
      { header: 'Grupo', key: 'workerGroup', width: 16 },
      { header: 'Horas prácticas', key: 'internshipTotalHours', width: 18 },
      { header: 'Vacaciones anuales', key: 'vacationAllowanceDays', width: 18 },
      { header: 'Vacaciones disponibles', key: 'vacationAvailableDays', width: 20 },
      { header: 'Bolsa horas', key: 'overtimeBalanceHours', width: 16 },
      { header: 'Alta', key: 'createdAt', width: 18 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9EAF7' },
    };
    headerRow.alignment = { vertical: 'middle' };

    for (const user of users) {
      worksheet.addRow({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        role: user.role === 'ADMIN' ? 'Administrador' : 'Trabajador',
        workerGroup:
          user.workerGroup === 'INTERN' ? 'Prácticas' : 'Trabajador',
        internshipTotalHours: user.internshipTotalHours ?? '',
        vacationAllowanceDays:
          user.vacationAllowanceDays ??
          user.vacationBalance?.allowanceDays ??
          '',
        vacationAvailableDays: user.vacationBalance?.availableDays ?? '',
        overtimeBalanceHours: user.overtimeBank?.balanceHours ?? '',
        createdAt: user.createdAt
          ? DateTime.fromJSDate(new Date(user.createdAt)).toFormat('dd/LL/yyyy')
          : '',
      });
    }

    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.autoFilter = {
      from: 'A1',
      to: 'J1',
    };

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    return {
      buffer,
      filename: 'personal_actual_empresa.xlsx',
    };
  }

  async sendUserAccess(firebaseUidAdmin: string, id: string) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    const user = await this.prisma.user.findFirst({
      where: { id, companyId: admin.companyId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.email) {
      throw new BadRequestException(
        'El usuario no tiene email, no se puede enviar acceso',
      );
    }

    const onboarding = await this.buildAccessOnboarding(user.email, false);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      onboarding,
    };
  }

  async updateUserGroup(
    firebaseUidAdmin: string,
    id: string,
    dto: UpdateUserGroupDto,
  ) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    const user = await this.prisma.user.findFirst({
      where: { id, companyId: admin.companyId },
      select: {
        id: true,
        role: true,
        workerGroup: true,
        internshipTotalHours: true,
        vacationAllowanceDays: true,
        overtimeBankMinutesAdjustment: true,
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const before: UserAuditSnapshot = {
      role: user.role,
      workerGroup: user.workerGroup,
      internshipTotalHours: user.internshipTotalHours,
      vacationAllowanceDays: user.vacationAllowanceDays,
      overtimeBankMinutesAdjustment: user.overtimeBankMinutesAdjustment ?? 0,
    };

    const after: UserAuditSnapshot = {
      role: user.role,
      workerGroup: dto.workerGroup,
      internshipTotalHours: user.internshipTotalHours,
      vacationAllowanceDays: user.vacationAllowanceDays,
      overtimeBankMinutesAdjustment: user.overtimeBankMinutesAdjustment ?? 0,
    };

    if (before.workerGroup === after.workerGroup) {
      return this.prisma.user.findFirst({
        where: { id: user.id, companyId: admin.companyId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          workerGroup: true,
          internshipTotalHours: true,
          vacationAllowanceDays: true,
          overtimeBankMinutesAdjustment: true,
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedRows = await tx.user.updateMany({
        where: { id: user.id, companyId: admin.companyId },
        data: {
          workerGroup: dto.workerGroup,
        },
      });
      if (updatedRows.count !== 1) {
        throw new NotFoundException('Usuario no encontrado');
      }

      const updated = await tx.user.findFirst({
        where: { id: user.id, companyId: admin.companyId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          workerGroup: true,
          internshipTotalHours: true,
          vacationAllowanceDays: true,
          overtimeBankMinutesAdjustment: true,
        },
      });
      if (!updated) throw new NotFoundException('Usuario no encontrado');

      await this.createUserAuditLog(tx, {
        actorUserId: admin.id,
        targetUserId: user.id,
        action: 'USER_GROUP_UPDATED',
        before,
        after,
      });

      return updated;
    });
  }

  async updateUserRole(
    firebaseUidAdmin: string,
    id: string,
    dto: UpdateUserRoleDto,
  ) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    const user = await this.prisma.user.findFirst({
      where: { id, companyId: admin.companyId },
      select: {
        id: true,
        role: true,
        workerGroup: true,
        internshipTotalHours: true,
        vacationAllowanceDays: true,
        overtimeBankMinutesAdjustment: true,
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const before: UserAuditSnapshot = {
      role: user.role,
      workerGroup: user.workerGroup,
      internshipTotalHours: user.internshipTotalHours,
      vacationAllowanceDays: user.vacationAllowanceDays,
      overtimeBankMinutesAdjustment: user.overtimeBankMinutesAdjustment ?? 0,
    };

    const after: UserAuditSnapshot = {
      role: dto.role,
      workerGroup: user.workerGroup,
      internshipTotalHours: user.internshipTotalHours,
      vacationAllowanceDays: user.vacationAllowanceDays,
      overtimeBankMinutesAdjustment: user.overtimeBankMinutesAdjustment ?? 0,
    };

    if (before.role === after.role) {
      return this.prisma.user.findFirst({
        where: { id: user.id, companyId: admin.companyId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          workerGroup: true,
          internshipTotalHours: true,
          vacationAllowanceDays: true,
          overtimeBankMinutesAdjustment: true,
        },
      });
    }

    if (user.role === 'ADMIN' && dto.role !== 'ADMIN') {
      const totalAdmins = await this.prisma.user.count({
        where: { role: 'ADMIN', companyId: admin.companyId },
      });
      if (totalAdmins <= 1) {
        throw new BadRequestException('Debe existir al menos un administrador');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedRows = await tx.user.updateMany({
        where: { id: user.id, companyId: admin.companyId },
        data: { role: dto.role },
      });
      if (updatedRows.count !== 1) {
        throw new NotFoundException('Usuario no encontrado');
      }

      const updated = await tx.user.findFirst({
        where: { id: user.id, companyId: admin.companyId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          workerGroup: true,
          internshipTotalHours: true,
          vacationAllowanceDays: true,
          overtimeBankMinutesAdjustment: true,
        },
      });
      if (!updated) throw new NotFoundException('Usuario no encontrado');

      await this.createUserAuditLog(tx, {
        actorUserId: admin.id,
        targetUserId: user.id,
        action: 'USER_ROLE_UPDATED',
        before,
        after,
      });

      return updated;
    });
  }

  async updateUserSettings(
    firebaseUidAdmin: string,
    id: string,
    dto: UpdateAdminUserDto,
  ) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    const user = await this.prisma.user.findFirst({
      where: { id, companyId: admin.companyId },
      select: {
        id: true,
        role: true,
        workerGroup: true,
        internshipTotalHours: true,
        vacationAllowanceDays: true,
        overtimeBankMinutesAdjustment: true,
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const nextRole = dto.role ?? user.role;
    const nextWorkerGroup = dto.workerGroup ?? user.workerGroup;

    if (user.role === 'ADMIN' && nextRole !== 'ADMIN') {
      const totalAdmins = await this.prisma.user.count({
        where: { role: 'ADMIN', companyId: admin.companyId },
      });
      if (totalAdmins <= 1) {
        throw new BadRequestException('Debe existir al menos un administrador');
      }
    }

    let nextInternshipTotalHours: number | null;
    if (nextWorkerGroup === 'INTERN') {
      if (dto.internshipTotalHours != null) {
        nextInternshipTotalHours = dto.internshipTotalHours;
      } else if (user.internshipTotalHours != null) {
        nextInternshipTotalHours = user.internshipTotalHours;
      } else {
        nextInternshipTotalHours = 0;
      }
    } else {
      nextInternshipTotalHours = null;
    }

    const before: UserAuditSnapshot = {
      role: user.role,
      workerGroup: user.workerGroup,
      internshipTotalHours: user.internshipTotalHours,
      vacationAllowanceDays: user.vacationAllowanceDays,
      overtimeBankMinutesAdjustment: user.overtimeBankMinutesAdjustment ?? 0,
    };
    const after: UserAuditSnapshot = {
      role: nextRole,
      workerGroup: nextWorkerGroup,
      internshipTotalHours: nextInternshipTotalHours,
      vacationAllowanceDays:
        dto.vacationAllowanceDays ?? user.vacationAllowanceDays ?? null,
      overtimeBankMinutesAdjustment:
        dto.overtimeBankMinutesAdjustment ??
        user.overtimeBankMinutesAdjustment ??
        0,
    };

    const fields: UserAuditField[] = [];
    if (dto.role !== undefined) fields.push('role');
    if (dto.workerGroup !== undefined) fields.push('workerGroup');
    if (
      dto.internshipTotalHours !== undefined &&
      nextWorkerGroup === 'INTERN'
    ) {
      fields.push('internshipTotalHours');
    }
    if (dto.vacationAllowanceDays !== undefined) {
      fields.push('vacationAllowanceDays');
    }
    if (dto.overtimeBankMinutesAdjustment !== undefined) {
      fields.push('overtimeBankMinutesAdjustment');
    }

    const changed =
      Object.keys(buildUserChangesMeta(before, after, fields)).length > 0;
    if (!changed) {
      return this.prisma.user.findFirst({
        where: { id: user.id, companyId: admin.companyId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          workerGroup: true,
          internshipTotalHours: true,
          vacationAllowanceDays: true,
          overtimeBankMinutesAdjustment: true,
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedRows = await tx.user.updateMany({
        where: { id: user.id, companyId: admin.companyId },
        data: {
          role: nextRole,
          workerGroup: nextWorkerGroup,
          internshipTotalHours: nextInternshipTotalHours,
          vacationAllowanceDays:
            dto.vacationAllowanceDays ?? user.vacationAllowanceDays ?? null,
          overtimeBankMinutesAdjustment:
            dto.overtimeBankMinutesAdjustment ??
            user.overtimeBankMinutesAdjustment ??
            0,
        },
      });
      if (updatedRows.count !== 1) {
        throw new NotFoundException('Usuario no encontrado');
      }

      const updated = await tx.user.findFirst({
        where: { id: user.id, companyId: admin.companyId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          workerGroup: true,
          internshipTotalHours: true,
          vacationAllowanceDays: true,
          overtimeBankMinutesAdjustment: true,
        },
      });
      if (!updated) throw new NotFoundException('Usuario no encontrado');

      await this.createUserAuditLog(tx, {
        actorUserId: admin.id,
        targetUserId: user.id,
        action: 'USER_SETTINGS_UPDATED',
        before,
        after,
        fields,
      });

      return updated;
    });
  }

  async updateInternshipHours(
    firebaseUidAdmin: string,
    id: string,
    dto: UpdateInternshipHoursDto,
  ) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    const user = await this.prisma.user.findFirst({
      where: { id, companyId: admin.companyId },
      select: {
        id: true,
        role: true,
        workerGroup: true,
        internshipTotalHours: true,
        vacationAllowanceDays: true,
        overtimeBankMinutesAdjustment: true,
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const before: UserAuditSnapshot = {
      role: user.role,
      workerGroup: user.workerGroup,
      internshipTotalHours: user.internshipTotalHours,
      vacationAllowanceDays: user.vacationAllowanceDays,
      overtimeBankMinutesAdjustment: user.overtimeBankMinutesAdjustment ?? 0,
    };
    const after: UserAuditSnapshot = {
      role: user.role,
      workerGroup: user.workerGroup,
      internshipTotalHours: dto.internshipTotalHours,
      vacationAllowanceDays: user.vacationAllowanceDays,
      overtimeBankMinutesAdjustment: user.overtimeBankMinutesAdjustment ?? 0,
    };

    if (before.internshipTotalHours === after.internshipTotalHours) {
      return this.prisma.user.findFirst({
        where: { id: user.id, companyId: admin.companyId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          workerGroup: true,
          internshipTotalHours: true,
          vacationAllowanceDays: true,
          overtimeBankMinutesAdjustment: true,
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedRows = await tx.user.updateMany({
        where: { id: user.id, companyId: admin.companyId },
        data: {
          internshipTotalHours: dto.internshipTotalHours,
        },
      });
      if (updatedRows.count !== 1) {
        throw new NotFoundException('Usuario no encontrado');
      }

      const updated = await tx.user.findFirst({
        where: { id: user.id, companyId: admin.companyId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          workerGroup: true,
          internshipTotalHours: true,
          vacationAllowanceDays: true,
          overtimeBankMinutesAdjustment: true,
        },
      });
      if (!updated) throw new NotFoundException('Usuario no encontrado');

      await this.createUserAuditLog(tx, {
        actorUserId: admin.id,
        targetUserId: user.id,
        action: 'USER_INTERNSHIP_HOURS_UPDATED',
        before,
        after,
      });

      return updated;
    });
  }

  async approveRequest(
    firebaseUidAdmin: string,
    id: string,
    dto?: ReviewRequestDto,
  ) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    const request = await this.prisma.request.findFirst({
      where: {
        id,
        user: { companyId: admin.companyId },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!request) throw new NotFoundException('Solicitud no encontrada');

    const updatedRows = await this.prisma.request.updateMany({
      where: { id: request.id, userId: request.userId },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedById: admin.id,
        reviewComment: dto?.reviewComment?.trim() || null,
      },
    });

    if (updatedRows.count !== 1) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    const updated = await this.prisma.request.findFirst({
      where: {
        id: request.id,
        userId: request.userId,
      },
      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
        source: true,
        startAt: true,
        endAt: true,
        comment: true,
        reviewComment: true,
        reviewedAt: true,
        reviewedById: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });
    if (!updated) throw new NotFoundException('Solicitud no encontrada');
    await this.syncApprovedRequestToSchedule(updated);
    await this.sendReviewedRequestNotification(admin, updated, 'APPROVED');
    await this.sendWhatsappReviewedRequestNotificationSafely(
      admin.companyId,
      updated,
      this.formatActorName(admin),
      'APPROVED',
    );

    return updated;
  }

  async rejectRequest(
    firebaseUidAdmin: string,
    id: string,
    dto?: ReviewRequestDto,
  ) {
    const admin = await this.getAdminForAudit(firebaseUidAdmin);

    const request = await this.prisma.request.findFirst({
      where: {
        id,
        user: { companyId: admin.companyId },
      },
      select: { id: true, userId: true },
    });

    if (!request) throw new NotFoundException('Solicitud no encontrada');

    const updatedRows = await this.prisma.request.updateMany({
      where: { id: request.id, userId: request.userId },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedById: admin.id,
        reviewComment: dto?.reviewComment?.trim() || null,
      },
    });

    if (updatedRows.count !== 1) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    const updated = await this.prisma.request.findFirst({
      where: {
        id: request.id,
        userId: request.userId,
      },
      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
        source: true,
        startAt: true,
        endAt: true,
        comment: true,
        reviewComment: true,
        reviewedAt: true,
        reviewedById: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });
    if (!updated) throw new NotFoundException('Solicitud no encontrada');
    await this.sendReviewedRequestNotification(admin, updated, 'REJECTED');
    await this.sendWhatsappReviewedRequestNotificationSafely(
      admin.companyId,
      updated,
      this.formatActorName(admin),
      'REJECTED',
    );

    return updated;
  }

  async assignVacation(firebaseUidAdmin: string, dto: AssignRequestDto) {
    return this.createAssignedRequest(firebaseUidAdmin, dto, 'VACATION');
  }

  async assignSickLeave(firebaseUidAdmin: string, dto: AssignRequestDto) {
    return this.createAssignedRequest(firebaseUidAdmin, dto, 'SICK_LEAVE');
  }

  async assignDayOff(firebaseUidAdmin: string, dto: AssignRequestDto) {
    return this.createAssignedRequest(firebaseUidAdmin, dto, 'DAY_OFF');
  }

  async assignOvertime(firebaseUidAdmin: string, dto: AssignRequestDto) {
    return this.createAssignedRequest(firebaseUidAdmin, dto, 'OVERTIME');
  }
}
