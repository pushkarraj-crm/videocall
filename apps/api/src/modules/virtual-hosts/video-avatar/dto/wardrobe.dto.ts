import { IsArray, IsBoolean, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class WardrobeOutfitDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsIn(['casual', 'party', 'business', 'summer', 'beach', 'fashion', 'evening'])
  category!:
    | 'casual'
    | 'party'
    | 'business'
    | 'summer'
    | 'beach'
    | 'fashion'
    | 'evening';

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  videoIdleUrl?: string;

  @IsOptional()
  @IsString()
  videoTalkUrl?: string;

  @IsOptional()
  @IsBoolean()
  approved?: boolean;
}

export class WardrobeConfigDto {
  @IsOptional()
  @IsString()
  activeOutfitId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WardrobeOutfitDto)
  outfits?: WardrobeOutfitDto[];
}