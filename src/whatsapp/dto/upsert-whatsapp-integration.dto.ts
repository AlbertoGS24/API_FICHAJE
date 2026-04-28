import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpsertWhatsappIntegrationDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayPhoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  phoneNumberId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessAccountId?: string;

  @IsOptional()
  @IsBoolean()
  allowClockIn?: boolean;

  @IsOptional()
  @IsBoolean()
  allowClockOut?: boolean;

  @IsOptional()
  @IsBoolean()
  requireLocation?: boolean;
}
