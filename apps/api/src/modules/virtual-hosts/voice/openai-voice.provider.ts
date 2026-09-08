import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VirtualHostVoiceConfig } from '../../../common/utils/virtual-host';
import type { VoiceProvider, VoiceSynthesisResult } from './voice-provider.interface';

@Injectable()
export class OpenAiVoiceProvider implements VoiceProvider {
  readonly name = 'openai' as const;
  private readonly logger = new Logger(OpenAiVoiceProvider.name);

  constructor(private readonly config: ConfigService) {}

  async synthesize(
    text: string,
    voiceConfig: VirtualHostVoiceConfig,
    signal?: AbortSignal,
  ): Promise<VoiceSynthesisResult> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const voice = voiceConfig.voiceId ?? 'nova';
    const speed = voiceConfig.speed ?? 1;

    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text.slice(0, 4096),
        voice,
        speed: Math.min(4, Math.max(0.25, speed)),
        response_format: 'mp3',
      }),
      signal,
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.warn(`OpenAI TTS failed: ${res.status} ${err.slice(0, 200)}`);
      throw new Error(`OpenAI TTS error: ${res.status}`);
    }

    const arrayBuf = await res.arrayBuffer();
    return { audio: Buffer.from(arrayBuf), mimeType: 'audio/mpeg' };
  }
}