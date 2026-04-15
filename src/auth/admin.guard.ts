import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestWithUser } from './request-with-user';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const firebaseUid = req.user?.uid;

    if (!firebaseUid) throw new ForbiddenException('Missing user context');

    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      select: {
        role: true,
        company: {
          select: {
            isActive: true,
          },
        },
      },
    });
    if (!user) throw new ForbiddenException('User not found in database');
    if (!user.company.isActive) {
      throw new ForbiddenException('Company disabled');
    }

    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
