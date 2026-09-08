import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const VOICE_EVENTS = [
  'message',
  'greeting',
  'gift_received',
  'recharge',
  'call_ending',
  'long_silence',
  'user_joined',
  'low_balance',
] as const;

export class VoiceStartDto {
  @IsString()
  callId!: string;

  @IsString()
  @MaxLength(4000)
  text!: string;

  @IsOptional()
  @IsIn(VOICE_EVENTS)
  eventType?: (typeof VOICE_EVENTS)[number];
}