import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AddBankAccountDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  accountHolderName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(20)
  accountNumber!: string;

  @IsString()
  @MinLength(11)
  @MaxLength(11)
  ifscCode!: string;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  upiId?: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}