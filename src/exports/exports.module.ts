import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

import { UserExportsController } from './user-exports.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ExportsController, UserExportsController],
  providers: [ExportsService],
  exports: [ExportsService],
})
export class ExportsModule {}
