import { Body, Controller, Get, Param, Post, Query, Sse, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Observable } from 'rxjs';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';
import { AiVoiceService } from './ai-voice.service';
import { VoiceInterruptDto } from './dto/voice-interrupt.dto';
import { VoiceStartDto } from './dto/voice-start.dto';
import { VoiceTestDto } from './dto/voice-test.dto';

@Controller('virtual-hosts/voice')
@UseGuards(JwtAuthGuard)
export class AiVoiceController {
  constructor(private readonly voice: AiVoiceService) {}

  @Get('voices')
  listVoices(@Query('provider') provider?: string) {
    return this.voice.listVoices(provider);
  }

  @Post('start')
  start(@CurrentUser() user: AuthenticatedUser, @Body() dto: VoiceStartDto) {
    return this.voice.startVoice(dto.callId, user.id, dto.text, dto.eventType ?? 'message');
  }

  @Sse('stream/:streamId')
  stream(
    @Param('streamId') streamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Observable<MessageEvent> {
    return this.voice.streamAudio(streamId, user.id);
  }

  @Post('interrupt')
  interrupt(@CurrentUser() user: AuthenticatedUser, @Body() dto: VoiceInterruptDto) {
    return this.voice.interruptVoice(user.id, dto.callId, dto.streamId);
  }

  @Post('test')
  @UseGuards(RolesGuard)
  @Roles(Role.admin, Role.super_admin)
  test(@Body() dto: VoiceTestDto) {
    return this.voice.testVoice(dto);
  }
}