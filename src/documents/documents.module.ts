import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ExportsModule } from '../exports/exports.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PrismaModule, ExportsModule, UsersModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
