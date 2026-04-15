import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class SetWorkplaceDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;

  @IsNumber()
  @Min(1)
  radiusMeters!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAllowedAccuracy?: number;

  @IsOptional()
  @IsBoolean()
  strictMode?: boolean;
}
