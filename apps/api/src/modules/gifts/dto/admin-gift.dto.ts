import { GiftAnimationTier, GiftCategory } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateGiftCatalogDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(16)
  icon!: string;

  @IsEnum(GiftCategory)
  category!: GiftCategory;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  coinPrice!: number;

  @IsEnum(GiftAnimationTier)
  animationTier!: GiftAnimationTier;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  animationKey!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  popularity?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isTrending?: boolean;

  @IsOptional()
  @IsBoolean()
  isLimited?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  seasonTag?: string;
}

export class UpdateGiftCatalogDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  icon?: string;

  @IsOptional()
  @IsEnum(GiftCategory)
  category?: GiftCategory;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  coinPrice?: number;

  @IsOptional()
  @IsEnum(GiftAnimationTier)
  animationTier?: GiftAnimationTier;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  animationKey?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  popularity?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isTrending?: boolean;

  @IsOptional()
  @IsBoolean()
  isLimited?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  seasonTag?: string | null;
}