import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class ActivateAdminWithKeyDto {
  @IsString()
  activationKey!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  captchaToken?: string;
}
