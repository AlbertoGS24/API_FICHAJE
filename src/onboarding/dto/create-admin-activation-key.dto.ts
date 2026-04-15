import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAdminActivationKeyDto {
  @IsString()
  @Matches(/^[A-Za-z]\d{7}[0-9A-Za-z]$/)
  companyCif!: string;

  @IsString()
  @MaxLength(120)
  companyName!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MaxLength(120)
  adminName!: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  companyLogoUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expiresInDays?: number;
}
