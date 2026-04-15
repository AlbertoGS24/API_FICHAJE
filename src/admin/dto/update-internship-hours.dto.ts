import { IsInt, Min } from 'class-validator';

export class UpdateInternshipHoursDto {
  @IsInt()
  @Min(0)
  internshipTotalHours!: number;
}
