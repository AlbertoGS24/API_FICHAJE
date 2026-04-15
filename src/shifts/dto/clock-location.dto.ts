import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class ClockLocationDto {
  @IsOptional()
  @IsUUID()
  workplaceId?: string;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;
}
