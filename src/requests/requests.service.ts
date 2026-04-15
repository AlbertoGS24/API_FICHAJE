import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateRequestDto } from './dto/create-request.dto';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  private async ensureUserId(firebaseUid: string) {
    const user = await this.usersService.findOrCreateByFirebaseUid(firebaseUid);
    return user.id;
  }

  async create(firebaseUid: string, dto: CreateRequestDto) {
    const userId = await this.ensureUserId(firebaseUid);

    const start = new Date(dto.startAt);
    const end = new Date(dto.endAt);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('startAt/endAt inválidos');
    }
    if (end <= start) {
      throw new BadRequestException('endAt debe ser posterior a startAt');
    }

    return this.prisma.request.create({
      data: {
        userId,
        type: dto.type as any,
        status: 'PENDING',
        source: 'EMPLOYEE',
        startAt: start,
        endAt: end,
        comment: dto.comment ?? null,
      },
    });
  }

  async getMine(
    firebaseUid: string,
    status?: string,
    type?: string,
    source?: string,
  ) {
    const userId = await this.ensureUserId(firebaseUid);

    return this.prisma.request.findMany({
      where: {
        userId,
        ...(status ? { status: status as any } : {}),
        ...(type ? { type: type as any } : {}),
        ...(source ? { source: source as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMineById(firebaseUid: string, id: string) {
    const userId = await this.ensureUserId(firebaseUid);
    const request = await this.prisma.request.findFirst({
      where: { id, userId },
      include: {
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!request) throw new NotFoundException('Solicitud no encontrada');
    return request;
  }

  async cancelMine(firebaseUid: string, id: string) {
    const userId = await this.ensureUserId(firebaseUid);

    const request = await this.prisma.request.findFirst({
      where: { id, userId },
    });

    if (!request) throw new NotFoundException('Solicitud no encontrada');
    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        'Solo se pueden cancelar solicitudes en estado PENDING',
      );
    }

    return this.prisma.request.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }
}
