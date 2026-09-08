import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class VoiceConfigDto {
  @IsOptional()
  @IsString()
  voiceProvider?: string;

  @IsOptional()
  @IsString()
  voiceId?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  emotion?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  speed?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  pitch?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  volume?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  stability?: number;

  @IsOptional()
  @IsString()
  style?: string;

  @IsOptional()
  @IsString()
  personality?: string;
}