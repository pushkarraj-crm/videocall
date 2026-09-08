import { IsInt, IsOptional, IsUUID, Max, Min, ValidateIf } from 'class-validator';

export class CheckoutPromoDto {
  @ValidateIf((o: CheckoutPromoDto) => o.customCoins == null)
  @IsOptional()
  @IsUUID()
  packageId?: string;

  @ValidateIf((o: CheckoutPromoDto) => !o.packageId)
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(10000)
  customCoins?: number;
}