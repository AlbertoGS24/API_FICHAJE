import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { getFirebaseAdminApp } from '../auth/firebase-admin';
import { PrismaService } from '../prisma/prisma.service';
import { CaptchaService } from './captcha.service';
import { getCompanyOnboardingConfig } from './company-onboarding.config';
import { ActivateAdminWithKeyDto } from './dto/activate-admin-with-key.dto';
import { CreateAdminActivationKeyDto } from './dto/create-admin-activation-key.dto';
import { SelfRegisterCompanyDto } from './dto/self-register-company.dto';

function normalizeCompanyCif(rawCif: string) {
  return rawCif
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '');
}

function isValidSpanishCif(cif: string): boolean {
  if (!/^[A-Z]\d{7}[0-9A-Z]$/.test(cif)) return false;

  const letter = cif[0];
  const digits = cif.slice(1, 8);
  const control = cif[8];

  let sumEven = 0;
  let sumOdd = 0;

  for (let i = 0; i < digits.length; i += 1) {
    const n = Number(digits[i]);
    const position = i + 1; // 1..7
    if (position % 2 === 0) {
      sumEven += n;
    } else {
      const doubled = n * 2;
      sumOdd += Math.floor(doubled / 10) + (doubled % 10);
    }
  }

  const total = sumEven + sumOdd;
  const controlDigit = (10 - (total % 10)) % 10;
  const controlDigitChar = String(controlDigit);
  const controlLetterChar = 'JABCDEFGHI'[controlDigit];

  if ('ABEH'.includes(letter)) {
    return control === controlDigitChar;
  }

  if ('KPQS'.includes(letter)) {
    return control === controlLetterChar;
  }

  return control === controlDigitChar || control === controlLetterChar;
}

function assertValidCif(cif: string) {
  if (!isValidSpanishCif(cif)) {
    throw new BadRequestException('CIF de empresa inválido');
  }
}

function normalizeEmail(rawEmail: string) {
  return rawEmail.trim().toLowerCase();
}

function normalizeActivationKey(rawKey: string) {
  return rawKey.trim().toUpperCase().replace(/\s+/g, '');
}

function hashActivationKey(rawKey: string) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

function buildActivationKey() {
  const p1 = crypto.randomBytes(4).toString('hex').toUpperCase();
  const p2 = crypto.randomBytes(4).toString('hex').toUpperCase();
  const p3 = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `ACT-${p1}-${p2}-${p3}`;
}

function hasFirebaseErrorCode(error: unknown, code: string): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: string }).code === code;
}

function getFirebaseWebApiKey(): string | null {
  const key =
    process.env.FIREBASE_WEB_API_KEY ?? process.env.FIREBASE_API_KEY ?? '';
  const normalized = key.trim();
  return normalized || null;
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly captchaService: CaptchaService,
  ) {}

  private async getAdmin(firebaseUidAdmin: string) {
    const admin = await this.prisma.user.findUnique({
      where: { firebaseUid: firebaseUidAdmin },
      select: {
        id: true,
        role: true,
      },
    });

    if (!admin) throw new NotFoundException('Admin no encontrado');
    if (admin.role !== 'ADMIN') {
      throw new BadRequestException('Acceso solo para administradores');
    }
    return admin;
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
    let onboardingMessage = 'Usuario activado correctamente.';

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

  async createActivationKey(
    firebaseUidAdmin: string,
    dto: CreateAdminActivationKeyDto,
  ) {
    const admin = await this.getAdmin(firebaseUidAdmin);

    const companyCode = normalizeCompanyCif(dto.companyCif);
    assertValidCif(companyCode);
    const companyName = dto.companyName.trim();
    const adminEmail = normalizeEmail(dto.adminEmail);
    const adminName = dto.adminName.trim();
    if (!adminName) {
      throw new BadRequestException(
        'El nombre del administrador es obligatorio',
      );
    }
    const companyLogoUrl = dto.companyLogoUrl?.trim() || null;
    const expiresInDays = dto.expiresInDays ?? 14;

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + expiresInDays);

    const [existingCompany, existingActiveKey] = await Promise.all([
      this.prisma.company.findUnique({
        where: { code: companyCode },
        select: { id: true },
      }),
      this.prisma.adminActivationKey.findFirst({
        where: {
          companyCode,
          usedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true },
      }),
    ]);

    if (existingCompany) {
      throw new BadRequestException('Ya existe una empresa activa con ese CIF');
    }

    if (existingActiveKey) {
      throw new BadRequestException(
        'Ya existe una clave de activación activa para ese CIF de empresa',
      );
    }

    const activationKey = buildActivationKey();
    const keyHash = hashActivationKey(normalizeActivationKey(activationKey));

    await this.prisma.adminActivationKey.create({
      data: {
        keyHash,
        companyCode,
        companyName,
        companyLogoUrl,
        adminEmail,
        adminName,
        expiresAt,
        createdByUserId: admin.id,
      },
    });

    return {
      activationKey,
      companyCif: companyCode,
      companyName,
      adminEmail,
      expiresAt,
      expiresInDays,
    };
  }

  async listActivationKeys(firebaseUidAdmin: string, limitRaw?: string) {
    const admin = await this.getAdmin(firebaseUidAdmin);

    const parsedLimit = Number(limitRaw ?? '50');
    const take = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 200)
      : 50;

    const now = new Date();

    const rows = await this.prisma.adminActivationKey.findMany({
      where: { createdByUserId: admin.id },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        companyCode: true,
        companyName: true,
        adminEmail: true,
        adminName: true,
        companyLogoUrl: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true,
      },
    });

    return rows.map((row) => ({
      ...row,
      companyCif: row.companyCode,
      status: row.usedAt ? 'USED' : row.expiresAt <= now ? 'EXPIRED' : 'ACTIVE',
    }));
  }

  async activateAdminWithKey(dto: ActivateAdminWithKeyDto, remoteIp?: string) {
    await this.captchaService.verifyOrThrow(dto.captchaToken, remoteIp);

    const normalizedKey = normalizeActivationKey(dto.activationKey);
    const keyHash = hashActivationKey(normalizedKey);
    const email = normalizeEmail(dto.email);
    const requestedName = dto.name.trim();
    if (!requestedName) {
      throw new BadRequestException(
        'El nombre del administrador es obligatorio',
      );
    }

    const invitation = await this.prisma.adminActivationKey.findUnique({
      where: { keyHash },
      select: {
        id: true,
        companyCode: true,
        companyName: true,
        companyLogoUrl: true,
        adminEmail: true,
        adminName: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (!invitation) {
      throw new BadRequestException('Clave de activación inválida');
    }

    if (invitation.usedAt) {
      throw new BadRequestException('Esta clave ya fue utilizada');
    }

    if (invitation.expiresAt <= new Date()) {
      throw new BadRequestException('La clave de activación está expirada');
    }

    if (email !== normalizeEmail(invitation.adminEmail)) {
      throw new BadRequestException(
        'El email no coincide con el asignado a esta clave',
      );
    }

    const existingCompany = await this.prisma.company.findUnique({
      where: { code: invitation.companyCode },
      select: { id: true },
    });

    if (existingCompany) {
      throw new BadRequestException(
        'La empresa de esta clave ya está activada',
      );
    }

    const firebaseApp = getFirebaseAdminApp();
    const displayName = requestedName || invitation.adminName || undefined;
    let firebaseUid: string | null = null;
    let createdInFirebase = false;
    let userCreatedInDb = false;

    try {
      const firebaseUser = await firebaseApp
        .auth()
        .getUserByEmail(email)
        .catch(async (error) => {
          if (hasFirebaseErrorCode(error, 'auth/user-not-found')) {
            createdInFirebase = true;
            return firebaseApp.auth().createUser({
              email,
              displayName,
            });
          }
          throw error;
        });

      firebaseUid = firebaseUser.uid;

      if (displayName && firebaseUser.displayName !== displayName) {
        await firebaseApp.auth().updateUser(firebaseUid, { displayName });
      }

      const existingUser = await this.prisma.user.findUnique({
        where: { firebaseUid },
        select: { id: true },
      });
      if (existingUser) {
        throw new BadRequestException(
          'Este usuario ya existe en la plataforma. Usa un email nuevo para activar otra empresa.',
        );
      }

      const ensuredFirebaseUid = firebaseUid;
      if (!ensuredFirebaseUid) {
        throw new BadRequestException(
          'No se pudo resolver el identificador del usuario en Firebase',
        );
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: {
            code: invitation.companyCode,
            name: invitation.companyName,
            logoUrl: invitation.companyLogoUrl ?? null,
          },
          select: {
            id: true,
            code: true,
            name: true,
            logoUrl: true,
          },
        });

        const user = await tx.user.create({
          data: {
            firebaseUid: ensuredFirebaseUid,
            companyId: company.id,
            email,
            name: displayName ?? null,
            role: 'ADMIN',
            workerGroup: 'EMPLOYEE',
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            workerGroup: true,
          },
        });

        await tx.adminActivationKey.update({
          where: { id: invitation.id },
          data: {
            usedAt: new Date(),
            usedByUserId: user.id,
            companyId: company.id,
          },
        });

        return { company, user };
      });

      userCreatedInDb = true;

      const onboarding = await this.buildAccessOnboarding(email, true);

      return {
        company: result.company,
        user: result.user,
        onboarding,
      };
    } catch (error) {
      if (firebaseUid && createdInFirebase && !userCreatedInDb) {
        await firebaseApp
          .auth()
          .deleteUser(firebaseUid)
          .catch(() => undefined);
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'No se pudo activar: datos duplicados en la plataforma',
          );
        }
      }

      if (hasFirebaseErrorCode(error, 'auth/invalid-email')) {
        throw new BadRequestException('Email inválido');
      }

      throw error;
    }
  }

  async selfRegisterCompany(dto: SelfRegisterCompanyDto, remoteIp?: string) {
    const onboarding = getCompanyOnboardingConfig();
    if (!onboarding.publicSelfRegisterEnabled) {
      throw new BadRequestException(
        'El registro público de empresas está deshabilitado. Usa una clave de activación.',
      );
    }

    await this.captchaService.verifyOrThrow(dto.captchaToken, remoteIp);

    const companyCode = normalizeCompanyCif(dto.companyCif);
    assertValidCif(companyCode);
    const companyName = dto.companyName.trim();
    const email = normalizeEmail(dto.adminEmail);
    const displayName = dto.adminName.trim();
    if (!displayName) {
      throw new BadRequestException(
        'El nombre del administrador es obligatorio',
      );
    }
    const companyLogoUrl = dto.companyLogoUrl?.trim() || null;

    const [existingCompany, existingUserWithEmail] = await Promise.all([
      this.prisma.company.findUnique({
        where: { code: companyCode },
        select: { id: true },
      }),
      this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      }),
    ]);

    if (existingCompany) {
      throw new BadRequestException(
        'Ya existe una empresa con ese CIF. Usa otro CIF.',
      );
    }

    if (existingUserWithEmail) {
      throw new BadRequestException(
        'Ese email ya está registrado en la plataforma.',
      );
    }

    const firebaseApp = getFirebaseAdminApp();
    let firebaseUid: string | null = null;
    let createdInFirebase = false;
    let userCreatedInDb = false;

    try {
      const firebaseUser = await firebaseApp
        .auth()
        .getUserByEmail(email)
        .catch(async (error) => {
          if (hasFirebaseErrorCode(error, 'auth/user-not-found')) {
            createdInFirebase = true;
            return firebaseApp.auth().createUser({
              email,
              displayName: displayName || undefined,
            });
          }
          throw error;
        });

      firebaseUid = firebaseUser.uid;
      if (displayName && firebaseUser.displayName !== displayName) {
        await firebaseApp.auth().updateUser(firebaseUid, { displayName });
      }

      const userByFirebase = await this.prisma.user.findUnique({
        where: { firebaseUid },
        select: { id: true },
      });
      if (userByFirebase) {
        throw new BadRequestException(
          'Ese usuario ya existe en la plataforma. Usa otro email.',
        );
      }

      const ensuredFirebaseUid = firebaseUid;
      if (!ensuredFirebaseUid) {
        throw new BadRequestException(
          'No se pudo resolver el identificador del usuario en Firebase',
        );
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: {
            code: companyCode,
            name: companyName,
            logoUrl: companyLogoUrl,
          },
          select: {
            id: true,
            code: true,
            name: true,
            logoUrl: true,
          },
        });

        const user = await tx.user.create({
          data: {
            firebaseUid: ensuredFirebaseUid,
            companyId: company.id,
            email,
            name: displayName,
            role: 'ADMIN',
            workerGroup: 'EMPLOYEE',
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            workerGroup: true,
          },
        });

        return { company, user };
      });

      userCreatedInDb = true;
      const onboarding = await this.buildAccessOnboarding(email, true);

      return {
        company: result.company,
        user: result.user,
        onboarding,
        companyCif: companyCode,
      };
    } catch (error) {
      if (firebaseUid && createdInFirebase && !userCreatedInDb) {
        await firebaseApp
          .auth()
          .deleteUser(firebaseUid)
          .catch(() => undefined);
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'No se pudo registrar la empresa: datos duplicados',
          );
        }
      }

      if (hasFirebaseErrorCode(error, 'auth/invalid-email')) {
        throw new BadRequestException('Email inválido');
      }
      if (hasFirebaseErrorCode(error, 'auth/email-already-exists')) {
        throw new BadRequestException(
          'Ese email ya está registrado en Firebase. Usa otro email.',
        );
      }

      throw error;
    }
  }
}
