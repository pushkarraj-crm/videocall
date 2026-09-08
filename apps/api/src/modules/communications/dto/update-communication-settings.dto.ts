import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateCommunicationSettingsDto {
  @IsOptional()
  @IsBoolean()
  marketingEmails?: boolean;

  @IsOptional()
  @IsBoolean()
  transactionalEmails?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingSms?: boolean;

  @IsOptional()
  @IsBoolean()
  transactionalSms?: boolean;

  @IsOptional()
  @IsBoolean()
  promotionEmails?: boolean;

  @IsOptional()
  @IsBoolean()
  promotionSms?: boolean;

  @IsOptional()
  @IsBoolean()
  referralUpdates?: boolean;
}