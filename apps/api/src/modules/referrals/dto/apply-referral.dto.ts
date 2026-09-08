import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApplyReferralDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  referralCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceFingerprint?: string;
}