import { IsOptional, IsString } from 'class-validator';

export class VoiceInterruptDto {
  @IsOptional()
  @IsString()
  callId?: string;

  @IsOptional()
  @IsString()
  streamId?: string;
}