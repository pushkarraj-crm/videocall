import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  incomingCalls?: boolean;

  @IsOptional()
  @IsBoolean()
  recharge?: boolean;

  @IsOptional()
  @IsBoolean()
  referral?: boolean;

  @IsOptional()
  @IsBoolean()
  promotions?: boolean;

  @IsOptional()
  @IsBoolean()
  withdrawals?: boolean;

  @IsOptional()
  @IsBoolean()
  kyc?: boolean;

  @IsOptional()
  @IsBoolean()
  reviews?: boolean;

  @IsOptional()
  @IsBoolean()
  announcements?: boolean;

  @IsOptional()
  @IsBoolean()
  browserPush?: boolean;

  @IsOptional()
  @IsBoolean()
  sound?: boolean;

  @IsOptional()
  @IsBoolean()
  vibration?: boolean;
}