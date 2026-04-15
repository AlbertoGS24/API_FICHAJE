import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewComment?: string;
}
