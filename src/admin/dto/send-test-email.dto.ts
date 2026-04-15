import { IsEmail, IsOptional } from 'class-validator';

export class SendTestEmailDto {
  @IsOptional()
  @IsEmail({}, { message: 'El email de prueba no es válido.' })
  email?: string;
}
