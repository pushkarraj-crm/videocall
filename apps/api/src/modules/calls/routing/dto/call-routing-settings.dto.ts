import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class UpdateCallRoutingSettingsDto {
  @IsOptional()
  @IsBoolean()
  aiFallbackEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(120)
  realHostTimeoutSeconds?: number;

  @IsOptional()
  @IsString()
  preferredRegion?: string;

  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @IsOptional()
  @IsBoolean()
  randomAiSelection?: boolean;

  @IsOptional()
  @IsUUID()
  defaultAiHostId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  maxConcurrentAiSessions?: number;
}