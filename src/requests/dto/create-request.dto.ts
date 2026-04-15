import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export enum RequestTypeDto {
  VACATION = 'VACATION',
  DAY_OFF = 'DAY_OFF',
  OVERTIME = 'OVERTIME',
  CORRECTION = 'CORRECTION',
}

export class CreateRequestDto {
  @IsEnum(RequestTypeDto)
  type!: RequestTypeDto;

  @IsISO8601()
  startAt!: string;

  @IsISO8601()
  endAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
