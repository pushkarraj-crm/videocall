import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCoinPackageDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsNumber()
  @Min(1)
  priceInr!: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  mrpInr?: number;

  @IsInt()
  @Min(1)
  coinUnits!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bonusUnits?: number;

  @IsOptional()
  @IsBoolean()
  isBestValue?: boolean;

  @IsOptional()
  @IsBoolean()
  isMostPopular?: boolean;

  @IsOptional()
  @IsBoolean()
  isLimitedOffer?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCoinPackageDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  priceInr?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  mrpInr?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  coinUnits?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bonusUnits?: number;

  @IsOptional()
  @IsBoolean()
  isBestValue?: boolean;

  @IsOptional()
  @IsBoolean()
  isMostPopular?: boolean;

  @IsOptional()
  @IsBoolean()
  isLimitedOffer?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}