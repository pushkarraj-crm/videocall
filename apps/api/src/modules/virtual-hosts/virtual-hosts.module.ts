import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { AdminVirtualHostsController } from './admin-virtual-hosts.controller';
import { AiConversationController } from './conversation/ai-conversation.controller';
import { AiConversationService } from './conversation/ai-conversation.service';
import { LocalAiProvider } from './conversation/local-ai.provider';
import { OpenAiProvider } from './conversation/openai-ai.provider';
import { AiAvatarController } from './avatar/ai-avatar.controller';
import { AiVideoAvatarController } from './video-avatar/ai-video-avatar.controller';
import { AiVideoAvatarService } from './video-avatar/ai-video-avatar.service';
import { AiAvatarService } from './avatar/ai-avatar.service';
import { AiVoiceController } from './voice/ai-voice.controller';
import { AiVoiceService } from './voice/ai-voice.service';
import { CartesiaVoiceProvider } from './voice/cartesia-voice.provider';
import { ElevenLabsVoiceProvider } from './voice/elevenlabs-voice.provider';
import { LocalVoiceProvider } from './voice/local-voice.provider';
import { OpenAiVoiceProvider } from './voice/openai-voice.provider';
import { VoiceCache } from './voice/voice-cache';
import { VirtualHostsController } from './virtual-hosts.controller';
import { VirtualHostsService } from './virtual-hosts.service';

@Module({
  imports: [WalletModule],
  controllers: [
    VirtualHostsController,
    AdminVirtualHostsController,
    AiConversationController,
    AiVoiceController,
    AiAvatarController,
    AiVideoAvatarController,
  ],
  providers: [
    VirtualHostsService,
    AiAvatarService,
    AiVideoAvatarService,
    AiConversationService,
    LocalAiProvider,
    OpenAiProvider,
    AiVoiceService,
    VoiceCache,
    LocalVoiceProvider,
    OpenAiVoiceProvider,
    ElevenLabsVoiceProvider,
    CartesiaVoiceProvider,
  ],
  exports: [
    VirtualHostsService,
    AiConversationService,
    AiVoiceService,
    AiAvatarService,
    AiVideoAvatarService,
  ],
})
export class VirtualHostsModule {}