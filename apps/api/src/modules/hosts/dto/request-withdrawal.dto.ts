import { IsUUID, Min } from 'class-validator';

export class RequestWithdrawalDto {
  @IsUUID()
  bankAccountId!: string;

  @Min(1)
  amountUnits!: number;
}