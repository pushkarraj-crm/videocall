import { IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class VoiceTestDto {
  @IsString()
  @MaxLength(2000)
  text!: string;

  @IsOptional()
  @IsString()
  hostId?: string;

  @IsOptional()
  @IsObject()
  voice?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  language?: string;

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
  @IsString()
  emotion?: string;
}