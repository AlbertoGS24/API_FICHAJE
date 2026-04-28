import { IsString, MaxLength, MinLength } from 'class-validator';

export class SendTestWhatsappMessageDto {
  @IsString()
  @MinLength(8)
  @MaxLength(24)
  toPhone!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;
}
