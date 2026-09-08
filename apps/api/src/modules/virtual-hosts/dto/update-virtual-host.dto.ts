import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Gender, HostProfileType, VirtualHostStatus } from '@prisma/client';

export class UpdateVirtualHostDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  hostName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  virtualHostUsername?: string;

  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(99)
  age?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  country?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsArray()
  virtualHostGallery?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  primaryLanguage?: string;

  @IsOptional()
  @IsEnum(HostProfileType)
  profileType?: HostProfileType;

  @IsOptional()
  @IsBoolean()
  virtualHostEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  virtualHostPriority?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  virtualHostPopularity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  virtualHostLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  virtualHostRegion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  virtualHostGreeting?: string;

  @IsOptional()
  @IsEnum(VirtualHostStatus)
  virtualHostStatus?: VirtualHostStatus;

  @IsOptional()
  @IsObject()
  virtualHostVoice?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  virtualHostAvatar?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  virtualHostPersonality?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  virtualHostGiftReactions?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  virtualHostSchedule?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  virtualHostConversation?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  virtualHostVideo?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  virtualHostWardrobe?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  coinsPerMinute?: number;
}