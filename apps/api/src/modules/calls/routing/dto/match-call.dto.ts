import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MatchCallDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  preferredLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  preferredRegion?: string;
}