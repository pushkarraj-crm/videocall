import { IsString, MaxLength, MinLength } from 'class-validator';

export class ConfirmPaymentDto {
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  orderId!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(64)
  paymentId!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  signature!: string;
}