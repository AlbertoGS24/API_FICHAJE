import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ImportOfficialHolidaysDto {
  @IsOptional()
  @IsInt()
  @Min(2024)
  @Max(2100)
  year?: number;
}
