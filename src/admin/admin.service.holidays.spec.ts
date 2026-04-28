import { BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduleService } from '../schedule/schedule.service';
import { MailService } from '../mail/mail.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

type MockFn = jest.Mock<any, any>;

function createServiceDeps() {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
    },
    holiday: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
  };

  const schedule = {
    syncRangeByType: jest.fn(),
  };

  const mail = {
    sendTextEmail: jest.fn(),
  };

  const whatsapp = {
    sendReviewedRequestNotification: jest.fn(),
  };

  return { prisma, schedule, mail, whatsapp };
}

describe('AdminService official holidays import', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('importa festivos oficiales de Madrid evitando duplicados', async () => {
    const { prisma, schedule, mail, whatsapp } = createServiceDeps();
    (prisma.user.findUnique as MockFn).mockResolvedValue({
      id: 'admin-1',
      email: 'admin@empresa.com',
      name: 'Admin',
      role: 'ADMIN',
      companyId: 'company-1',
    });
    (prisma.company.findUnique as MockFn).mockResolvedValue({
      id: 'company-1',
      code: 'C1',
      name: 'Empresa',
      country: 'España',
      region: 'Comunidad de Madrid',
      province: 'Madrid',
      municipality: 'Aranjuez',
      postalCode: '28300',
    });
    (prisma.holiday.findMany as MockFn).mockResolvedValue([
      {
        id: 'existing-1',
        date: new Date('2026-01-01T00:00:00.000Z'),
        name: 'Año Nuevo',
        scope: 'NATIONAL',
      },
    ]);
    (prisma.holiday.createMany as MockFn).mockResolvedValue({ count: 2 });

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              año: '2026',
              fecha_festivo: '2026-01-01',
              festividad: 'Año Nuevo',
            },
            {
              año: '2026',
              fecha_festivo: '2026-05-02',
              festividad: 'Fiesta de la Comunidad de Madrid',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              año: '2026',
              municipio_nombre: 'Aranjuez',
              fecha_festivo: '2026-09-08',
            },
          ],
        }),
      }) as any;

    const service = new AdminService(
      prisma as unknown as PrismaService,
      schedule as unknown as ScheduleService,
      mail as unknown as MailService,
      whatsapp as unknown as WhatsappService,
    );

    const result = await service.importOfficialHolidays('firebase-admin', {
      year: 2026,
    });

    expect(prisma.holiday.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            companyId: 'company-1',
            name: 'Fiesta de la Comunidad de Madrid',
            scope: 'REGIONAL',
          }),
          expect.objectContaining({
            companyId: 'company-1',
            name: 'Festivo local de Aranjuez',
            scope: 'LOCAL',
          }),
        ]),
      }),
    );
    expect(result).toMatchObject({
      year: 2026,
      municipality: 'Aranjuez',
      imported: 2,
      skipped: 1,
      totalOfficialFound: 3,
      source: 'Comunidad de Madrid',
    });
  });

  it('rechaza la importacion automatica fuera de Madrid', async () => {
    const { prisma, schedule, mail, whatsapp } = createServiceDeps();
    (prisma.user.findUnique as MockFn).mockResolvedValue({
      id: 'admin-1',
      email: 'admin@empresa.com',
      name: 'Admin',
      role: 'ADMIN',
      companyId: 'company-1',
    });
    (prisma.company.findUnique as MockFn).mockResolvedValue({
      id: 'company-1',
      code: 'C1',
      name: 'Empresa',
      country: 'España',
      region: 'Andalucía',
      province: 'Sevilla',
      municipality: 'Sevilla',
      postalCode: '41001',
    });

    const service = new AdminService(
      prisma as unknown as PrismaService,
      schedule as unknown as ScheduleService,
      mail as unknown as MailService,
      whatsapp as unknown as WhatsappService,
    );

    await expect(
      service.importOfficialHolidays('firebase-admin', { year: 2026 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.holiday.createMany).not.toHaveBeenCalled();
  });
});
