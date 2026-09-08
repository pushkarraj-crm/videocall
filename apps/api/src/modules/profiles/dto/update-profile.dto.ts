import { Gender } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  displayName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  bio?: string;

  /** Host-only public about text (falls back to user bio on public profile). */
  @IsString()
  @IsOptional()
  @MaxLength(500)
  hostBio?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  primaryLanguage?: string;

  /** Absolute or site-relative URL (e.g. /user-media/…/avatar.jpg). */
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  avatarUrl?: string;
}
