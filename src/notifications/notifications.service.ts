import {
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private readonly advisoryLockA = 20260310;
  private readonly advisoryLockB = 1;
  private readonly runMinute = this.parseRunMinute();
  private readonly warmupDelayMs = 15000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  onModuleInit() {
    // Primera ejecución para no esperar al primer tick de cron
    setTimeout(() => {
      this.runRulesWithLock().catch((err) => {
        console.error('Error running notification rules at bootstrap', err);
      });
    }, this.warmupDelayMs);

    this.scheduleNextRun();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private parseRunMinute() {
    const parsed = Number(process.env.NOTIFICATIONS_CRON_MINUTE ?? '0');
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 59) return 0;
    return Math.floor(parsed);
  }

  private computeNextRun(from = new Date()) {
    const next = new Date(from);
    next.setUTCSeconds(0, 0);
    next.setUTCMinutes(this.runMinute);
    if (next <= from) {
      next.setUTCHours(next.getUTCHours() + 1);
    }
    return next;
  }

  private scheduleNextRun() {
    if (this.timer) clearTimeout(this.timer);
    const now = new Date();
    const next = this.computeNextRun(now);
    const delay = Math.max(1000, next.getTime() - now.getTime());

    this.timer = setTimeout(() => {
      this.runRulesWithLock()
        .catch((err) => {
          console.error('Error running notification rules in cron tick', err);
        })
        .finally(() => {
          this.scheduleNextRun();
        });
    }, delay);
  }

  private async runRulesWithLock() {
    const lockRows = await this.prisma.$queryRawUnsafe(
      `SELECT pg_try_advisory_lock($1, $2) AS locked`,
      this.advisoryLockA,
      this.advisoryLockB,
    );

    const hasLock = !!lockRows?.[0]?.locked;
    if (!hasLock) return;

    try {
      await this.runRules();
    } finally {
      await this.prisma.$queryRawUnsafe(
        `SELECT pg_advisory_unlock($1, $2)`,
        this.advisoryLockA,
        this.advisoryLockB,
      );
    }
  }

  private async ensureUserId(firebaseUid: string) {
    const user = await this.usersService.findOrCreateByFirebaseUid(firebaseUid);
    return user.id;
  }

  private async createNotificationIfNotExists(params: {
    userId: string;
    type: 'INTERN_40H_REMAINING' | 'WEEKLY_LIMIT_EXCEEDED';
    scopeKey: string;
    message: string;
    meta?: any;
  }) {
    return this.prisma.notification.upsert({
      where: {
        userId_type_scopeKey: {
          userId: params.userId,
          type: params.type,
          scopeKey: params.scopeKey,
        },
      },
      update: {},
      create: {
        userId: params.userId,
        type: params.type,
        scopeKey: params.scopeKey,
        message: params.message,
        meta: params.meta ?? null,
      },
    });
  }

  private async applyRulesToUser(userId: string) {
    const progress = await this.usersService.getProgressByUserId(userId);

    if (
      progress.workerGroup === 'INTERN' &&
      progress.internship.totalHours > 0 &&
      progress.internship.pendingHours <= 40
    ) {
      await this.createNotificationIfNotExists({
        userId,
        type: 'INTERN_40H_REMAINING',
        scopeKey: 'INTERN_40H',
        message: `Te quedan ${progress.internship.pendingHours} horas de prácticas (umbral: 40h).`,
        meta: {
          pendingHours: progress.internship.pendingHours,
          totalHours: progress.internship.totalHours,
        },
      });
    }

    if (progress.workerGroup === 'EMPLOYEE' && progress.weekly.exceeded) {
      const weekStart = this.usersService.getCurrentWeekStart();
      const weekKey = weekStart.toISOString().slice(0, 10);
      await this.createNotificationIfNotExists({
        userId,
        type: 'WEEKLY_LIMIT_EXCEEDED',
        scopeKey: `WEEK_${weekKey}`,
        message: `Has superado el límite semanal (${progress.weekly.limitHours}h). Llevas ${progress.weekly.workedHours}h.`,
        meta: {
          weeklyHours: progress.weekly.workedHours,
          weeklyLimitHours: progress.weekly.limitHours,
          weekStart,
        },
      });
    }
  }

  async runRules() {
    const users = await this.prisma.user.findMany({
      where: {
        role: 'EMPLOYEE',
      },
      select: {
        id: true,
      },
    });

    for (const u of users) {
      await this.applyRulesToUser(u.id);
    }
  }

  async listMine(firebaseUid: string) {
    const userId = await this.ensureUserId(firebaseUid);

    // Evalúa reglas al consultar para que los avisos estén al día
    await this.applyRulesToUser(userId);

    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(firebaseUid: string, id: string) {
    const userId = await this.ensureUserId(firebaseUid);

    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!notification)
      throw new NotFoundException('Notificación no encontrada');

    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }
}
