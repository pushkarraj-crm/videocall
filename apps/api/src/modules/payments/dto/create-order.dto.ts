import { IsInt, IsOptional, IsUUID, Max, Min, ValidateIf } from 'class-validator';

export class CreateOrderDto {
  @ValidateIf((o: CreateOrderDto) => o.customCoins == null)
  @IsUUID()
  packageId?: string;

  @ValidateIf((o: CreateOrderDto) => !o.packageId)
  @IsInt()
  @Min(100)
  @Max(10000)
  customCoins?: number;
}