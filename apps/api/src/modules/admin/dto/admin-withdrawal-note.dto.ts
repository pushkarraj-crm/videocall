import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminWithdrawalNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}