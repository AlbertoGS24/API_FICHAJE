import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateTimesheetDocumentDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
