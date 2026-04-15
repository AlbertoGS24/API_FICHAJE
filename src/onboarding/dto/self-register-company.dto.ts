import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export class SelfRegisterCompanyDto {
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
  @IsString()
  @MaxLength(4096)
  captchaToken?: string;
}
