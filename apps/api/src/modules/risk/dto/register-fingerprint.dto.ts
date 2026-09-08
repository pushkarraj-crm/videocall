import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterFingerprintDto {
  @IsString()
  @MaxLength(64)
  fingerprint!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  os?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  resolution?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  browser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;
}