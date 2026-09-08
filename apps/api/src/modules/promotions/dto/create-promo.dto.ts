import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PromoCampaignType,
  PromoDiscountType,
  PromoVisibility,
} from '@prisma/client';

export class CreatePromoDto {
  @IsString()
  @MaxLength(32)
  code!: string;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(PromoCampaignType)
  campaignType!: PromoCampaignType;

  @IsEnum(PromoDiscountType)
  discountType!: PromoDiscountType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumRecharge?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bonusCoins?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cashbackCoins?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  usagePerUser?: number;

  @IsOptional()
  @IsEnum(PromoVisibility)
  visibility?: PromoVisibility;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}