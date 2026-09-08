import { Injectable } from '@nestjs/common';
import {
  type ConversationContext,
  generateLocalReply,
  type GeneratedReply,
} from '../../../common/utils/conversation-engine';
import type { AiProvider } from './ai-provider.interface';

@Injectable()
export class LocalAiProvider implements AiProvider {
  readonly name = 'local';

  async generate(ctx: ConversationContext, userMessage?: string): Promise<GeneratedReply> {
    return generateLocalReply(ctx, userMessage);
  }
}