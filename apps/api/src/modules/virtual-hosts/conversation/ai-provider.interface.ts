import type { ConversationContext, GeneratedReply } from '../../../common/utils/conversation-engine';

export interface AiProvider {
  readonly name: string;
  generate(ctx: ConversationContext, userMessage?: string): Promise<GeneratedReply>;
}