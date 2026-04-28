import { Role, WorkerGroup } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAdminUserDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[+\d()\s-]+$/, {
    message:
      'El teléfono debe estar en formato internacional, por ejemplo +34600111222',
  })
  phone?: string;

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

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  sendPasswordSetupEmail?: boolean;
}
