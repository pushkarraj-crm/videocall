import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateGrievanceDto {
  @IsUUID()
  @IsOptional()
  userId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  complainantName!: string;

  @IsEmail()
  complainantEmail!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;
}