import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class WalletAdjustDto {
  @IsInt()
  @Min(1)
  @Max(100000)
  amountCoins!: number;

  @IsEnum(['credit', 'debit', 'refund'])
  action!: 'credit' | 'debit' | 'refund';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}