import { Gender } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CompleteOnboardingDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  displayName!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  primaryLanguage?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  bio?: string;

  @IsBoolean()
  acceptTerms!: boolean;

  @IsBoolean()
  acceptPrivacy!: boolean;

  @IsBoolean()
  acceptCommunityGuidelines!: boolean;

  @IsBoolean()
  ageDeclaration!: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  referralCode?: string;

  @IsString()
  @IsOptional()
  deviceFingerprint?: string;
}