import { Role, WorkerGroup } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateAdminUserDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(WorkerGroup)
  workerGroup?: WorkerGroup;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  internshipTotalHours?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  vacationAllowanceDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  overtimeBankMinutesAdjustment?: number;
}
