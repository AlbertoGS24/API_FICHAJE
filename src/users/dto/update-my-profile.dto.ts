import {
  IsEmail,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateMyProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @IsEmail()
  @MaxLength(190)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[+\d()\s-]+$/, {
    message: 'El teléfono solo puede contener números, espacios y +()-',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @IsISO8601()
  birthDate?: string;
}
