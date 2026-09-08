import { IsOptional, IsString, IsUUID, MaxLength, Min, ValidateIf } from 'class-validator';

export class RequestWithdrawalDto {
  @ValidateIf((dto: RequestWithdrawalDto) => !dto.upiId)
  @IsUUID()
  bankAccountId?: string;

  @ValidateIf((dto: RequestWithdrawalDto) => !dto.bankAccountId)
  @IsString()
  @MaxLength(128)
  upiId?: string;

  @ValidateIf((dto: RequestWithdrawalDto) => !dto.bankAccountId)
  @IsString()
  @MaxLength(128)
  accountHolderName?: string;

  @Min(1)
  amountUnits!: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}