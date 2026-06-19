import { IsOptional, IsString, MaxLength } from 'class-validator';

export class InitiateKycDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  provider?: string;
}