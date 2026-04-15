import {
  ArrayNotEmpty,
  ArrayUnique,
  IsIn,
  IsInt,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

export class UpsertScheduleEntryDto {
  @IsString()
  userId!: string;

  @Matches(DATE_RE, { message: 'La fecha debe tener formato YYYY-MM-DD' })
  date!: string;

  @IsIn(['WORK', 'VACATION', 'SICK_LEAVE', 'DAY_OFF', 'HOLIDAY'])
  type!: 'WORK' | 'VACATION' | 'SICK_LEAVE' | 'DAY_OFF' | 'HOLIDAY';

  @IsOptional()
  @Matches(TIME_RE, { message: 'La hora de inicio debe tener formato HH:mm' })
  startTime?: string;

  @IsOptional()
  @Matches(TIME_RE, { message: 'La hora de fin debe tener formato HH:mm' })
  endTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class BulkUpsertScheduleEntriesDto {
  @IsString()
  userId!: string;

  @Matches(DATE_RE, {
    message: 'La fecha inicial debe tener formato YYYY-MM-DD',
  })
  fromDate!: string;

  @Matches(DATE_RE, { message: 'La fecha final debe tener formato YYYY-MM-DD' })
  toDate!: string;

  @IsIn(['WORK', 'VACATION', 'SICK_LEAVE', 'DAY_OFF', 'HOLIDAY'])
  type!: 'WORK' | 'VACATION' | 'SICK_LEAVE' | 'DAY_OFF' | 'HOLIDAY';

  @IsOptional()
  @Matches(TIME_RE, { message: 'La hora de inicio debe tener formato HH:mm' })
  startTime?: string;

  @IsOptional()
  @Matches(TIME_RE, { message: 'La hora de fin debe tener formato HH:mm' })
  endTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ArrayNotEmpty({ message: 'Debes seleccionar al menos un día de la semana' })
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekdays!: number[];
}

export class UpsertScheduleTemplateDto {
  @IsString()
  userId!: string;

  @IsIn(['WORK', 'VACATION', 'SICK_LEAVE', 'DAY_OFF', 'HOLIDAY'])
  type!: 'WORK' | 'VACATION' | 'SICK_LEAVE' | 'DAY_OFF' | 'HOLIDAY';

  @IsOptional()
  @Matches(TIME_RE, { message: 'La hora de inicio debe tener formato HH:mm' })
  startTime?: string;

  @IsOptional()
  @Matches(TIME_RE, { message: 'La hora de fin debe tener formato HH:mm' })
  endTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ArrayNotEmpty({ message: 'Debes seleccionar al menos un día de la semana' })
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekdays!: number[];
}

export class ApplyScheduleTemplateDto {
  @IsString()
  userId!: string;

  @Matches(MONTH_RE, { message: 'El mes debe tener formato YYYY-MM' })
  month!: string;
}

export class CopyScheduleMonthDto {
  @IsString()
  userId!: string;

  @Matches(MONTH_RE, { message: 'El mes origen debe tener formato YYYY-MM' })
  sourceMonth!: string;

  @Matches(MONTH_RE, { message: 'El mes destino debe tener formato YYYY-MM' })
  targetMonth!: string;
}

export class MarkMySickLeaveDto {
  @Matches(DATE_RE, {
    message: 'La fecha inicial debe tener formato YYYY-MM-DD',
  })
  fromDate!: string;

  @Matches(DATE_RE, { message: 'La fecha final debe tener formato YYYY-MM-DD' })
  toDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
