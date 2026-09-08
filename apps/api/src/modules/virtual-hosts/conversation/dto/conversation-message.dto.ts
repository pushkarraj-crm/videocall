import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ConversationMessageDto {
  @IsString()
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientTurnId?: string;
}