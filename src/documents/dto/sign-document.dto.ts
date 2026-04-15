import { IsString, MinLength } from 'class-validator';

export class SignDocumentDto {
  @IsString()
  @MinLength(20)
  signatureImageBase64!: string;
}
