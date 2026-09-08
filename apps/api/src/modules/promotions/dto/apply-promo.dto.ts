import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class ApplyPromoDto {
  @IsString()
  @MaxLength(32)
  code!: string;

  @ValidateIf((o: ApplyPromoDto) => o.customCoins == null)
  @IsOptional()
  @IsUUID()
  packageId?: string;

  @ValidateIf((o: ApplyPromoDto) => !o.packageId)
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(10000)
  customCoins?: number;
}