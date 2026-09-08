import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class WalletRechargeDto {
  @IsOptional()
  @IsUUID()
  packageId?: string;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(10000)
  customCoins?: number;
}