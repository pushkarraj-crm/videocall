import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateRiskProfileDto {
  @IsOptional()
  @IsBoolean()
  freezeWithdrawals?: boolean;

  @IsOptional()
  @IsBoolean()
  freezeReferralRewards?: boolean;

  @IsOptional()
  @IsBoolean()
  freezeCouponRedemption?: boolean;

  @IsOptional()
  @IsBoolean()
  requireReKyc?: boolean;

  @IsOptional()
  @IsBoolean()
  markSafe?: boolean;

  @IsOptional()
  @IsBoolean()
  suspendAccount?: boolean;

  @IsOptional()
  @IsBoolean()
  unsuspendAccount?: boolean;

  @IsOptional()
  @IsString()
  adminNote?: string;
}