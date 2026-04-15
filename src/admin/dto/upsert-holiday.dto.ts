import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateHolidayDto {
  @Matches(DATE_RE, { message: 'La fecha debe tener formato YYYY-MM-DD' })
  date!: string;

  @IsString()
  @MaxLength(150)
  name!: string;

  @IsIn(['NATIONAL', 'REGIONAL', 'PROVINCIAL', 'LOCAL', 'COMPANY'])
  scope!: 'NATIONAL' | 'REGIONAL' | 'PROVINCIAL' | 'LOCAL' | 'COMPANY';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  municipality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateHolidayDto extends CreateHolidayDto {}
