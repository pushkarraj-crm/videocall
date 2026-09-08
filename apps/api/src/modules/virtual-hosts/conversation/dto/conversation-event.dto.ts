import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CALL_EVENT_TYPES } from '../../../../common/utils/conversation-engine';

export class ConversationEventDto {
  @IsIn([...CALL_EVENT_TYPES])
  eventType!: (typeof CALL_EVENT_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  giftName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  metadata?: string;
}