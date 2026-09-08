import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class KycCallbackDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  providerReference!: string;

  @IsIn(['verified', 'failed'])
  status!: 'verified' | 'failed';

  @IsOptional()
  @IsString()
  @MaxLength(20)
  pan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  aadhaarMasked?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  failureReason?: string;
}