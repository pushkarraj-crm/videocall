import { IsString, MaxLength } from 'class-validator';

export class CallConsentDto {
  @IsString()
  @MaxLength(20)
  documentVersion!: string;
}