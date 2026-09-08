import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class UpdateAIHostMemoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  favoriteColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  favoriteFood?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  favoriteMovie?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  favoriteMusic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  favoriteOutfit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  birthday?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  relationshipScore?: number;
}

export class AdminMemoryQueryDto {
  @IsOptional()
  @IsUUID()
  hostId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}