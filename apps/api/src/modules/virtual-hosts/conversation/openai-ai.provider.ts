import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buildSystemPrompt,
  type ConversationContext,
  extractTopics,
  generateLocalReply,
  type GeneratedReply,
  pickEmotion,
} from '../../../common/utils/conversation-engine';
import type { AiProvider } from './ai-provider.interface';

@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAiProvider.name);

  constructor(private readonly config: ConfigService) {}

  async generate(ctx: ConversationContext, userMessage?: string): Promise<GeneratedReply> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      return generateLocalReply(ctx, userMessage);
    }

    const model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
    const temperature = ctx.conversation.temperature ?? 0.75;

    try {
      const messages = [
        { role: 'system' as const, content: buildSystemPrompt(ctx) },
        ...(ctx.memory.recentTurns ?? []).map((t) => ({
          role: t.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: t.content,
        })),
      ];
      if (userMessage) messages.push({ role: 'user', content: userMessage });

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: 180,
          messages,
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) throw new Error(`OpenAI ${res.status}`);
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('Empty OpenAI response');

      return {
        text: text.slice(0, 500),
        emotion: pickEmotion(ctx.personality, ctx.eventType, ctx.conversation.defaultEmotion),
        topics: extractTopics(userMessage ?? text),
      };
    } catch (err) {
      this.logger.warn(`OpenAI fallback to local: ${err}`);
      return generateLocalReply(ctx, userMessage);
    }
  }
}