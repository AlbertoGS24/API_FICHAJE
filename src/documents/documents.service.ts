import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ExportsService } from '../exports/exports.service';
import { CreateTimesheetDocumentDto } from './dto/create-timesheet-document.dto';
import { SignDocumentDto } from './dto/sign-document.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exportsService: ExportsService,
    private readonly usersService: UsersService,
  ) {}

  private async ensureUser(firebaseUid: string) {
    return this.usersService.findOrCreateByFirebaseUid(firebaseUid);
  }

  private cleanBase64(input: string) {
    return input.replace(/^data:image\/[a-zA-Z+.-]+;base64,/, '').trim();
  }

  async createTimesheet(firebaseUid: string, dto: CreateTimesheetDocumentDto) {
    const user = await this.ensureUser(firebaseUid);
    const fromDate = new Date(dto.from);
    const toDate = new Date(dto.to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('Fechas inválidas');
    }

    const hasSigned = await this.prisma.document.findFirst({
      where: {
        userId: user.id,
        type: 'TIMESHEET',
        fromDate,
        toDate,
        status: 'SIGNED',
      },
      select: { id: true },
    });

    if (hasSigned) {
      throw new BadRequestException(
        'Ya existe un documento firmado para ese rango. Es inmutable.',
      );
    }

    const { buffer } = await this.exportsService.generateMyTimesheetPdf(
      firebaseUid,
      dto.from,
      dto.to,
      dto.timezone,
    );
    const pdfBytes = Uint8Array.from(buffer);

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    return this.prisma.document.create({
      data: {
        type: 'TIMESHEET',
        status: 'DRAFT',
        userId: user.id,
        fromDate,
        toDate,
        pdfBytes,
        sha256,
      },
      select: {
        id: true,
        status: true,
        type: true,
        fromDate: true,
        toDate: true,
        sha256: true,
        signedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async sign(firebaseUid: string, id: string, dto: SignDocumentDto) {
    const user = await this.ensureUser(firebaseUid);

    const document = await this.prisma.document.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: {
        id: true,
        status: true,
        fromDate: true,
        toDate: true,
        pdfBytes: true,
      },
    });

    if (!document) throw new NotFoundException('Documento no encontrado');
    if (document.status === 'SIGNED') {
      throw new BadRequestException('Documento ya firmado. Es inmutable.');
    }
    if (!document.pdfBytes) {
      throw new BadRequestException('Documento sin PDF generado');
    }

    const cleaned = this.cleanBase64(dto.signatureImageBase64);
    const signatureBytes = Uint8Array.from(Buffer.from(cleaned, 'base64'));
    if (!signatureBytes.length) {
      throw new BadRequestException('Firma inválida (base64 vacío)');
    }

    const from = document.fromDate.toISOString().slice(0, 10);
    const to = document.toDate.toISOString().slice(0, 10);
    const signedAt = new Date();

    const { buffer: signedPdfBuffer } =
      await this.exportsService.generateMyTimesheetPdf(
        firebaseUid,
        from,
        to,
        undefined,
        dto.signatureImageBase64,
        signedAt,
      );

    const signedPdfBytes = Uint8Array.from(signedPdfBuffer);
    const sha256 = crypto
      .createHash('sha256')
      .update(signedPdfBuffer)
      .digest('hex');

    return this.prisma.document.update({
      where: { id },
      data: {
        status: 'SIGNED',
        signedAt,
        signatureImage: signatureBytes,
        pdfBytes: signedPdfBytes,
        sha256,
      },
      select: {
        id: true,
        status: true,
        type: true,
        fromDate: true,
        toDate: true,
        sha256: true,
        signedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async listMine(firebaseUid: string) {
    const user = await this.ensureUser(firebaseUid);
    return this.prisma.document.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        status: true,
        type: true,
        fromDate: true,
        toDate: true,
        sha256: true,
        signedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMineById(firebaseUid: string, id: string) {
    const user = await this.ensureUser(firebaseUid);

    const document = await this.prisma.document.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        status: true,
        type: true,
        fromDate: true,
        toDate: true,
        sha256: true,
        signedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!document) throw new NotFoundException('Documento no encontrado');
    return document;
  }

  async downloadMine(firebaseUid: string, id: string) {
    const user = await this.ensureUser(firebaseUid);

    const document = await this.prisma.document.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        type: true,
        status: true,
        fromDate: true,
        toDate: true,
        pdfBytes: true,
        sha256: true,
      },
    });

    if (!document || !document.pdfBytes) {
      throw new NotFoundException('Documento no encontrado');
    }
    if (document.status !== 'SIGNED') {
      throw new BadRequestException(
        'Debes firmar el documento antes de descargarlo',
      );
    }

    const from = document.fromDate.toISOString().slice(0, 10);
    const to = document.toDate.toISOString().slice(0, 10);

    return {
      buffer: Buffer.from(document.pdfBytes),
      sha256: document.sha256,
      filename: `timesheet_${from}_${to}_${document.id}.pdf`,
    };
  }
}
