import { Body, Controller, Get, Param, Post, Query, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';
import { AiConversationService } from './ai-conversation.service';
import { ConversationEventDto } from './dto/conversation-event.dto';
import { ConversationMessageDto } from './dto/conversation-message.dto';

@Controller('virtual-hosts/conversation')
@UseGuards(JwtAuthGuard)
export class AiConversationController {
  constructor(private readonly conversation: AiConversationService) {}

  @Get(':callId/context')
  preloadContext(@Param('callId') callId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.conversation.preloadContext(callId, user.id);
  }

  @Get(':callId/history')
  history(@Param('callId') callId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.conversation.getHistory(callId, user.id);
  }

  @Post(':callId/message')
  message(
    @Param('callId') callId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConversationMessageDto,
  ) {
    return this.conversation.sendMessage(callId, user.id, dto.message, dto.clientTurnId);
  }

  @Sse(':callId/stream')
  stream(
    @Param('callId') callId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('message') message: string,
  ): Observable<MessageEvent> {
    return this.conversation.streamMessage(callId, user.id, message ?? '');
  }

  @Post(':callId/event')
  event(
    @Param('callId') callId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConversationEventDto,
  ) {
    return this.conversation.handleEvent(callId, user.id, dto.eventType, dto.giftName);
  }

  @Post(':callId/interrupt')
  interrupt(@Param('callId') callId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.conversation.interruptStream(callId, user.id);
  }
}