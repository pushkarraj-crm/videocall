import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class VideoConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(['cinematic', 'video'])
  renderMode?: 'cinematic' | 'video';

  @IsOptional()
  @IsIn(['close', 'medium', 'portrait', 'auto'])
  cameraMode?: 'close' | 'medium' | 'portrait' | 'auto';

  @IsOptional()
  @IsBoolean()
  autoZoom?: boolean;

  @IsOptional()
  @IsBoolean()
  dynamicFraming?: boolean;

  @IsOptional()
  @IsIn(['phoneme', 'energy'])
  lipSyncMode?: 'phoneme' | 'energy';

  @IsOptional()
  @IsIn(['idle', 'talking', 'listening', 'laughing', 'thinking', 'celebrating'])
  activePose?: 'idle' | 'talking' | 'listening' | 'laughing' | 'thinking' | 'celebrating';

  @IsOptional()
  @IsBoolean()
  idleDrift?: boolean;

  @IsOptional()
  @IsBoolean()
  eyeTracking?: boolean;

  @IsOptional()
  @IsObject()
  clips?: Record<string, string>;
}