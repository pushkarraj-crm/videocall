import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SendGiftExtendedDto {
  @IsString()
  @MaxLength(64)
  giftId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number;

  /** Client-provided idempotency key to prevent duplicate sends */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}