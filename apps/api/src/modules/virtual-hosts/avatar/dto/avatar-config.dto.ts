import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class AvatarConfigDto {
  @IsOptional()
  @IsString()
  defaultIdleAnimation?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  expressionIntensity?: number;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  blinkFrequency?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsIn(['subtle', 'normal', 'expressive'])
  headMovement?: 'subtle' | 'normal' | 'expressive';

  @IsOptional()
  @IsBoolean()
  reactionsEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  lipSyncIntensity?: number;

  @IsOptional()
  @IsBoolean()
  idleSchedulerEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(15000)
  minAnimationCooldownMs?: number;
}