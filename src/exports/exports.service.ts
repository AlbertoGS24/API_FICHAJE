/**
 * Módulo de Exports: Permite exportar datos de la aplicación en formatos como XLSX y PDF.
 *
 * Este módulo incluye:
 * - ExportsController: Controlador para endpoints de exportación.
 * - UserExportsController: Controlador para endpoints de exportación específicos del usuario autenticado.
 * - ExportsService: Servicio con la lógica de negocio para generar los archivos de exportación.
 *
 * El módulo se encarga de manejar las solicitudes de exportación, validar los parámetros, consultar la base de datos y generar los archivos en el formato solicitado. Utiliza la librería ExcelJS para generar archivos XLSX y PDFKit para generar archivos PDF.
 * Los endpoints de este módulo están protegidos por autenticación y autorización, asegurando que solo los usuarios autorizados puedan acceder a las exportaciones.
 * El módulo se integra con el resto de la aplicación a través de su controlador y servicio, y puede ser fácilmente extendido para soportar nuevos formatos de exportación o nuevas funcionalidades relacionadas con la exportación de datos.
 * El módulo también incluye validaciones para asegurar que los parámetros de fecha sean correctos y que el rango de fechas sea válido. Además, se generan nombres de archivo descriptivos para facilitar la identificación de los archivos exportados.
 * En resumen, el módulo de Exports es una parte fundamental de la aplicación que permite a los usuarios obtener sus datos en formatos fácilmente utilizables para análisis, reportes o almacenamiento externo.
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import ExcelJS from 'exceljs';
import crypto from 'crypto';
import { DateTime } from 'luxon';
import { calculateExpectedWorkMinutes } from '../shared/work-metrics';

function formatForExcel(d: Date, tz: string) {
  return DateTime.fromJSDate(d).setZone(tz).toFormat('dd/LL/yyyy HH:mm');
}

function formatDateInZone(d: Date, tz: string) {
  return DateTime.fromJSDate(d).setZone(tz).toFormat('dd/LL/yyyy');
}

function formatTimeInZone(d: Date, tz: string) {
  return DateTime.fromJSDate(d).setZone(tz).toFormat('HH:mm');
}

function minutesToHoursStr(minutes: number) {
  const hours = minutes / 60;
  return hours < 1 ? `${minutes} min` : `${hours.toFixed(2)} h`;
}

function formatCoordinate(value: number) {
  return Number(value).toFixed(5);
}

function locationSummary(
  address?: string | null,
  lat?: number | null,
  lng?: number | null,
) {
  if (address) return address;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `Lat ${formatCoordinate(lat!)}, Lng ${formatCoordinate(lng!)}`;
  }
  return '-';
}

function workplaceDisplayName(workplace?: {
  name?: string | null;
  addressLabel?: string | null;
} | null) {
  if (!workplace) return '-';
  return workplace.name || workplace.addressLabel || '-';
}

function timesheetFilenamePart(user: {
  name?: string | null;
  email?: string | null;
  firebaseUid?: string | null;
}) {
  const raw =
    (user.name || '').trim() ||
    user.email ||
    user.firebaseUid ||
    'empleado';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

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

@Injectable()
export class ExportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getUserByFirebaseUid(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      select: {
        id: true,
        firebaseUid: true,
        companyId: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  private async getAdmin(firebaseUidAdmin: string) {
    const admin = await this.prisma.user.findUnique({
      where: { firebaseUid: firebaseUidAdmin },
      select: { id: true, role: true, companyId: true },
    });
    if (!admin) throw new NotFoundException('Admin no encontrado');
    if (admin.role !== 'ADMIN') {
      throw new BadRequestException('Acceso solo para administradores');
    }
    return admin;
  }

  private async getCompanyUserForAdminExport(
    firebaseUidAdmin: string,
    userId: string,
  ) {
    const admin = await this.getAdmin(firebaseUidAdmin);
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId: admin.companyId,
      },
      select: {
        id: true,
        firebaseUid: true,
        companyId: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      throw new NotFoundException(
        'No se encontró la persona seleccionada dentro de tu empresa',
      );
    }

    return user;
  }

  async companyXlsx(
    firebaseUidAdmin: string,
    from: string,
    to: string,
  ): Promise<{ buffer: Buffer; filename: string; sha256: string }> {
    const admin = await this.getAdmin(firebaseUidAdmin);
    const fromDate = parseDateOnly(from);
    const toDate = parseDateOnly(to);
    if (toDate < fromDate)
      throw new BadRequestException('"to" debe ser >= "from"');

    const toExclusive = addDaysUTC(toDate, 1);
    const timezone = 'Europe/Madrid';

    const shifts = await this.prisma.shift.findMany({
      where: {
        startAt: { gte: fromDate, lt: toExclusive },
        endAt: { not: null },
        user: { companyId: admin.companyId },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ userId: 'asc' }, { startAt: 'asc' }],
    });
    const expectedByUser = await calculateExpectedWorkMinutes({
      prisma: this.prisma,
      companyId: admin.companyId,
      userIds: [...new Set(shifts.map((shift) => shift.userId))],
      from: fromDate,
      toExclusive,
    });

    const byUser = new Map<
      string,
      {
        name: string | null;
        email: string | null;
        minutes: number;
        expectedMinutes: number;
        shiftsCount: number;
      }
    >();

    const byDayUser = new Map<
      string,
      {
        date: string;
        userId: string;
        name: string | null;
        email: string | null;
        minutes: number;
        shiftsCount: number;
      }
    >();

    let companyTotalMinutes = 0;

    const rowsShifts: Array<{
      userId: string;
      name: string | null;
      email: string | null;
      startAt: Date;
      endAt: Date;
      minutes: number;
    }> = [];

    for (const s of shifts) {
      const start = new Date(s.startAt);
      const end = new Date(s.endAt!);
      const diffMs = end.getTime() - start.getTime();
      const minutes = diffMs > 0 ? Math.ceil(diffMs / 60000) : 0;

      companyTotalMinutes += minutes;

      const curr = byUser.get(s.userId) ?? {
        name: s.user.name ?? null,
        email: s.user.email ?? null,
        minutes: 0,
        expectedMinutes: expectedByUser.get(s.userId) ?? 0,
        shiftsCount: 0,
      };

      curr.minutes += minutes;
      curr.shiftsCount += 1;
      byUser.set(s.userId, curr);

      const dateKey = formatDateInZone(start, timezone);
      const byDayKey = `${s.userId}_${dateKey}`;
      const currDay = byDayUser.get(byDayKey) ?? {
        date: dateKey,
        userId: s.userId,
        name: s.user.name ?? null,
        email: s.user.email ?? null,
        minutes: 0,
        shiftsCount: 0,
      };

      currDay.minutes += minutes;
      currDay.shiftsCount += 1;
      byDayUser.set(byDayKey, currDay);

      rowsShifts.push({
        userId: s.userId,
        name: s.user.name ?? null,
        email: s.user.email ?? null,
        startAt: start,
        endAt: end,
        minutes,
      });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'API Fichar';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.subject = 'Informe de horas trabajadas';
    workbook.title = `Informe empresa ${from} - ${to}`;
    workbook.company = 'App Fichar';

    const borderThin = {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const },
    };

    const headerFill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFD9EAF7' },
    };

    const zebraFill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFF7F9FC' },
    };

    // =========================
    // HOJA 1: SUMMARY
    // =========================
    const wsSummary = workbook.addWorksheet('Summary', {
      properties: { tabColor: { argb: 'FF4F81BD' } },
      views: [{ state: 'frozen', ySplit: 4 }],
    });

    wsSummary.columns = [
      { header: 'Empleado', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Minutos', key: 'minutes', width: 12 },
      { header: 'Horas', key: 'hours', width: 12 },
      { header: 'Horas esperadas', key: 'expectedHours', width: 16 },
      { header: 'Balance', key: 'balanceHours', width: 12 },
      { header: 'Turnos', key: 'shifts', width: 10 },
    ];

    wsSummary.mergeCells('A1:G1');
    wsSummary.getCell('A1').value = 'Resumen de horas por empleado';
    wsSummary.getCell('A1').font = {
      size: 16,
      bold: true,
      color: { argb: 'FF1F1F1F' },
    };
    wsSummary.getCell('A1').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    wsSummary.getRow(1).height = 24;

    wsSummary.mergeCells('A2:G2');
    wsSummary.getCell('A2').value =
      `Periodo: ${from} a ${to} | Zona horaria: ${timezone}`;
    wsSummary.getCell('A2').font = {
      size: 10,
      italic: true,
      color: { argb: 'FF666666' },
    };
    wsSummary.getCell('A2').alignment = { horizontal: 'center' };

    wsSummary.addRow([]);

    const summaryHeaderRow = wsSummary.addRow([
      'Empleado',
      'Email',
      'Minutos',
      'Horas',
      'Horas esperadas',
      'Balance',
      'Turnos',
    ]);
    summaryHeaderRow.font = { bold: true };
    summaryHeaderRow.fill = headerFill;
    summaryHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
    summaryHeaderRow.eachCell((cell) => {
      cell.border = borderThin;
    });

    for (const [userId, v] of byUser.entries()) {
      const row = wsSummary.addRow({
        name: v.name ?? userId,
        email: v.email ?? '',
        minutes: v.minutes,
        hours: Number((v.minutes / 60).toFixed(2)),
        expectedHours: Number((v.expectedMinutes / 60).toFixed(2)),
        balanceHours: Number(((v.minutes - v.expectedMinutes) / 60).toFixed(2)),
        shifts: v.shiftsCount,
      });

      row.eachCell((cell) => {
        cell.border = borderThin;
        cell.alignment = { vertical: 'middle' };
      });

      if (row.number % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = zebraFill;
        });
      }
    }

    const totalExpectedMinutes = [...expectedByUser.values()].reduce(
      (acc, minutes) => acc + minutes,
      0,
    );
    wsSummary.addRow([]);
    const totalRow = wsSummary.addRow([
      'TOTAL EMPRESA',
      '',
      companyTotalMinutes,
      Number((companyTotalMinutes / 60).toFixed(2)),
      Number((totalExpectedMinutes / 60).toFixed(2)),
      Number(((companyTotalMinutes - totalExpectedMinutes) / 60).toFixed(2)),
      rowsShifts.length,
    ]);

    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2F0D9' },
    };
    totalRow.eachCell((cell) => {
      cell.border = borderThin;
      cell.alignment = { vertical: 'middle' };
    });

    wsSummary.getColumn('minutes').alignment = { horizontal: 'center' };
    wsSummary.getColumn('hours').alignment = { horizontal: 'center' };
    wsSummary.getColumn('expectedHours').alignment = { horizontal: 'center' };
    wsSummary.getColumn('balanceHours').alignment = { horizontal: 'center' };
    wsSummary.getColumn('shifts').alignment = { horizontal: 'center' };

    // =========================
    // HOJA 2: SHIFTS
    // =========================
    const wsShifts = workbook.addWorksheet('Shifts', {
      properties: { tabColor: { argb: 'FF9BBB59' } },
      views: [{ state: 'frozen', ySplit: 2 }],
    });

    wsShifts.columns = [
      { header: 'Empleado', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Inicio', key: 'start', width: 20 },
      { header: 'Fin', key: 'end', width: 20 },
      { header: 'Minutos', key: 'minutes', width: 12 },
      { header: 'Horas', key: 'hours', width: 12 },
    ];

    wsShifts.mergeCells('A1:F1');
    wsShifts.getCell('A1').value = 'Detalle de turnos';
    wsShifts.getCell('A1').font = { size: 16, bold: true };
    wsShifts.getCell('A1').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    wsShifts.getRow(1).height = 24;

    const shiftsHeaderRow = wsShifts.getRow(2);
    shiftsHeaderRow.values = [
      'Empleado',
      'Email',
      'Inicio',
      'Fin',
      'Minutos',
      'Horas',
    ];
    shiftsHeaderRow.font = { bold: true };
    shiftsHeaderRow.fill = headerFill;
    shiftsHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
    shiftsHeaderRow.eachCell((cell) => {
      cell.border = borderThin;
    });

    for (const r of rowsShifts) {
      const hours = Number((r.minutes / 60).toFixed(2));

      const row = wsShifts.addRow({
        name: r.name ?? r.userId,
        email: r.email ?? '',
        start: formatForExcel(r.startAt, timezone),
        end: formatForExcel(r.endAt, timezone),
        minutes: r.minutes,
        hours,
      });

      row.eachCell((cell) => {
        cell.border = borderThin;
        cell.alignment = { vertical: 'middle' };
      });

      if (row.number % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = zebraFill;
        });
      }
    }

    wsShifts.getColumn('minutes').alignment = { horizontal: 'center' };
    wsShifts.getColumn('hours').alignment = { horizontal: 'center' };

    // =========================
    // HOJA 3: DAILY SUMMARY
    // =========================
    const wsDaily = workbook.addWorksheet('Daily Summary', {
      properties: { tabColor: { argb: 'FFF4B183' } },
      views: [{ state: 'frozen', ySplit: 2 }],
    });

    wsDaily.columns = [
      { header: 'Fecha', key: 'date', width: 15 },
      { header: 'Empleado', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Minutos', key: 'minutes', width: 12 },
      { header: 'Horas', key: 'hours', width: 12 },
      { header: 'Turnos', key: 'shifts', width: 10 },
    ];

    wsDaily.mergeCells('A1:F1');
    wsDaily.getCell('A1').value = 'Resumen diario por empleado';
    wsDaily.getCell('A1').font = { size: 16, bold: true };
    wsDaily.getCell('A1').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    wsDaily.getRow(1).height = 24;

    const dailyHeaderRow = wsDaily.getRow(2);
    dailyHeaderRow.values = [
      'Fecha',
      'Empleado',
      'Email',
      'Minutos',
      'Horas',
      'Turnos',
    ];
    dailyHeaderRow.font = { bold: true };
    dailyHeaderRow.fill = headerFill;
    dailyHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
    dailyHeaderRow.eachCell((cell) => {
      cell.border = borderThin;
    });

    const dailyRows = Array.from(byDayUser.values()).sort((a, b) => {
      if (a.date === b.date) return (a.name ?? '').localeCompare(b.name ?? '');
      const aParts = a.date.split('/').reverse().join('-');
      const bParts = b.date.split('/').reverse().join('-');
      return aParts.localeCompare(bParts);
    });

    for (const item of dailyRows) {
      const row = wsDaily.addRow({
        date: item.date,
        name: item.name ?? item.userId ?? item.email,
        email: item.email ?? '',
        minutes: item.minutes,
        hours: Number((item.minutes / 60).toFixed(2)),
        shifts: item.shiftsCount,
      });

      row.eachCell((cell) => {
        cell.border = borderThin;
        cell.alignment = { vertical: 'middle' };
      });

      if (row.number % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = zebraFill;
        });
      }
    }

    wsDaily.getColumn('minutes').alignment = { horizontal: 'center' };
    wsDaily.getColumn('hours').alignment = { horizontal: 'center' };
    wsDaily.getColumn('shifts').alignment = { horizontal: 'center' };

    // Filtros automáticos
    wsSummary.autoFilter = {
      from: 'A4',
      to: 'E4',
    };

    wsShifts.autoFilter = {
      from: 'A2',
      to: 'F2',
    };

    wsDaily.autoFilter = {
      from: 'A2',
      to: 'F2',
    };

    // Generar el xlsx
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    // Hash SHA256 para posibles usos futuros (firma/sellado)
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    const filename = `company_${from}_to_${to}.xlsx`;
    return { buffer, filename, sha256 };
  }

  /**
   * Genera un PDF con el resumen de horas trabajadas del usuario
   * en el rango dado.
   */
  private async generateTimesheetPdfForUser(
    user: {
      id: string;
      firebaseUid: string;
      companyId: string;
      email: string | null;
      name: string | null;
    },
    from: string,
    to: string,
    tz: string | undefined,
    signatureImageBase64?: string,
    signedAt?: Date,
  ) {
    const fromDate = parseDateOnly(from);
    const toDate = parseDateOnly(to);
    const toDateExclusive = addDaysUTC(toDate, 1);

    const shifts = await this.prisma.shift.findMany({
      where: {
        userId: user.id,
        startAt: { gte: fromDate, lt: toDateExclusive },
        endAt: { not: null },
      },
      include: {
        workplace: {
          select: {
            name: true,
            addressLabel: true,
          },
        },
      },
      orderBy: { startAt: 'asc' },
    });

    let totalMinutes = 0;

    shifts.forEach((s) => {
      const diff = new Date(s.endAt!).getTime() - new Date(s.startAt).getTime();
      totalMinutes += Math.ceil(diff / 60000);
    });

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();

    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));

    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
    });

    doc.fontSize(18).text('Resumen de horas trabajadas');

    const employeeLabel =
      (user.name || '').trim() || user.email || user.firebaseUid;
    const employeeMeta =
      user.email && employeeLabel !== user.email ? ` · ${user.email}` : '';

    doc.moveDown();
    doc.fontSize(12).text(`Empleado: ${employeeLabel}${employeeMeta}`);
    doc.text(`Periodo: ${from} - ${to}`);

    doc.moveDown();
    doc.text(`Total horas: ${(totalMinutes / 60).toFixed(2)}`);

    doc.moveDown();
    doc.fontSize(13).text('Detalle de turnos', { underline: true });
    doc.moveDown(0.5);

    const timezone =
      typeof tz === 'string' && tz.length > 0 ? tz : 'Europe/Madrid';

    const pageMargin = 50;
    const pageWidth = doc.page.width;
    const usableWidth = pageWidth - pageMargin * 2;

    const colFechaX = pageMargin;
    const colEntradaX = pageMargin + usableWidth * 0.35;
    const colSalidaX = pageMargin + usableWidth * 0.55;
    const colDuracionX = pageMargin + usableWidth * 0.73;

    function drawHeader() {
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Fecha', colFechaX, doc.y);
      doc.text('Entrada', colEntradaX, doc.y);
      doc.text('Salida', colSalidaX, doc.y);
      doc.text('Duración', colDuracionX, doc.y);

      doc.moveDown(0.6);
      doc
        .moveTo(pageMargin, doc.y)
        .lineTo(pageWidth - pageMargin, doc.y)
        .stroke();
      doc.moveDown(0.4);
      doc.font('Helvetica');
    }

    function ensureSpaceForRow(requiredHeight: number) {
      const bottomLimit = doc.page.height - pageMargin;
      if (doc.y + requiredHeight > bottomLimit) {
        doc.addPage();
        drawHeader();
      }
    }

    drawHeader();

    if (shifts.length === 0) {
      doc.fontSize(10).text('Sin turnos cerrados en este rango.');
    } else {
      doc.fontSize(10);

      for (const s of shifts) {
        const start = new Date(s.startAt);
        const end = new Date(s.endAt!);

        const diffMs = end.getTime() - start.getTime();
        const minutes = diffMs > 0 ? Math.ceil(diffMs / 60000) : 0;
        const fecha = formatDateInZone(start, timezone);
        const entrada = formatTimeInZone(start, timezone);
        const salida = formatTimeInZone(end, timezone);
        const duracion = minutesToHoursStr(minutes);
        const workplaceLabel = workplaceDisplayName(s.workplace);
        const startLocation = locationSummary(
          s.startAddress,
          s.startLat,
          s.startLng,
        );
        const endLocation = locationSummary(
          s.endAddress,
          s.endLat,
          s.endLng,
        );

        const locationParts: string[] = [];
        if (workplaceLabel !== '-') {
          locationParts.push(`Centro: ${workplaceLabel}`);
        }
        if (
          startLocation !== '-' &&
          endLocation !== '-' &&
          startLocation !== endLocation
        ) {
          locationParts.push(`Entrada: ${startLocation}`);
          locationParts.push(`Salida: ${endLocation}`);
        } else if (startLocation !== '-') {
          locationParts.push(`Ubicación: ${startLocation}`);
        } else if (endLocation !== '-') {
          locationParts.push(`Ubicación: ${endLocation}`);
        }

        const locationLine = locationParts.join(' · ');
        const detailHeight = locationLine
          ? doc.heightOfString(locationLine, { width: usableWidth })
          : 0;
        const rowBlockHeight = 14 + (detailHeight ? detailHeight + 6 : 0) + 8;

        ensureSpaceForRow(rowBlockHeight);

        const y = doc.y;
        doc.text(fecha, colFechaX, y);
        doc.text(entrada, colEntradaX, y);
        doc.text(salida, colSalidaX, y);
        doc.text(duracion, colDuracionX, y);

        if (locationLine) {
          doc
            .fontSize(8.5)
            .fillColor('gray')
            .text(locationLine, pageMargin, y + 14, {
              width: usableWidth,
            });
        }

        doc.fontSize(10).fillColor('black').font('Helvetica');
        doc.y = y + rowBlockHeight;
      }
    }

    doc.moveDown(1);
    doc.fontSize(9).fillColor('gray').text(`Zona horaria: ${timezone}`);

    if (signatureImageBase64) {
      const cleaned = signatureImageBase64
        .replace(/^data:image\/[a-zA-Z+.-]+;base64,/, '')
        .trim();
      const signatureBuffer = Buffer.from(cleaned, 'base64');

      if (signatureBuffer.length > 0) {
        const blockHeight = 110;
        const bottomLimit = doc.page.height - pageMargin;
        if (doc.y + blockHeight > bottomLimit) {
          doc.addPage();
        }

        const signMaxWidth = Math.min(220, usableWidth * 0.5);

        doc.moveDown(0.6);
        doc
          .fontSize(11)
          .fillColor('black')
          .font('Helvetica-Bold')
          .text('Firma');
        const signTop = doc.y + 4;

        doc
          .rect(pageMargin, signTop, signMaxWidth + 20, 70)
          .lineWidth(1)
          .strokeColor('#AAB2AE')
          .stroke();

        doc.image(signatureBuffer, pageMargin + 10, signTop + 5, {
          fit: [signMaxWidth, 60],
        });

        doc.y = signTop + 74;
        const signedText = DateTime.fromJSDate(signedAt ?? new Date())
          .setZone(timezone)
          .toFormat('dd/LL/yyyy HH:mm:ss');

        doc
          .fontSize(9)
          .fillColor('gray')
          .font('Helvetica')
          .text(`Firmado: ${signedText} (${timezone})`);
      }
    }

    doc.fillColor('black').font('Helvetica');

    doc.end();

    const buffer = await pdfPromise;

    return {
      buffer,
      filename: `timesheet_${timesheetFilenamePart(user)}_${from}_${to}.pdf`,
    };
  }

  async generateMyTimesheetPdf(
    firebaseUid: string,
    from: string,
    to: string,
    tz: string | undefined,
    signatureImageBase64?: string,
    signedAt?: Date,
  ) {
    const user = await this.getUserByFirebaseUid(firebaseUid);
    return this.generateTimesheetPdfForUser(
      user,
      from,
      to,
      tz,
      signatureImageBase64,
      signedAt,
    );
  }

  async generateAdminUserTimesheetPdf(
    firebaseUidAdmin: string,
    userId: string,
    from: string,
    to: string,
    tz: string | undefined,
  ) {
    const user = await this.getCompanyUserForAdminExport(
      firebaseUidAdmin,
      userId,
    );
    return this.generateTimesheetPdfForUser(user, from, to, tz);
  }
}
