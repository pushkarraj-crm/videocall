import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelReferralDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}