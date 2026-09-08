import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SubmitKycDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @IsDateString()
  dob!: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/)
  @MaxLength(128)
  upiId!: string;

  @IsString()
  @Matches(/^\d{12}$/)
  aadhaarNumber!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/)
  panNumber?: string;

  @IsString()
  @MinLength(100)
  selfieImage!: string;

  @IsString()
  @MinLength(100)
  aadhaarFrontImage!: string;

  @IsString()
  @MinLength(100)
  aadhaarBackImage!: string;
}