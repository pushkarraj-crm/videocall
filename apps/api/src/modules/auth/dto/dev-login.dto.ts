import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class DevLoginDto {
  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  displayName?: string;

  @IsIn(['user', 'host', 'admin'])
  @IsOptional()
  role?: 'user' | 'host' | 'admin';

  @IsNumber()
  @IsOptional()
  seedCoins?: number;

  @IsBoolean()
  @IsOptional()
  completeOnboarding?: boolean;
}