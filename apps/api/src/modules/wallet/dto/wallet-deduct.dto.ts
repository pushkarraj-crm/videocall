import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class WalletDeductDto {
  @IsUUID()
  userId!: string;

  @IsInt()
  @Min(1)
  @Max(100000)
  amountCoins!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}