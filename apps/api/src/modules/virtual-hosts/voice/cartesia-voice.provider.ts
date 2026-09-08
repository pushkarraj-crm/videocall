import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VirtualHostVoiceConfig } from '../../../common/utils/virtual-host';
import type { VoiceProvider, VoiceSynthesisResult } from './voice-provider.interface';

@Injectable()
export class CartesiaVoiceProvider implements VoiceProvider {
  readonly name = 'cartesia' as const;
  private readonly logger = new Logger(CartesiaVoiceProvider.name);

  constructor(private readonly config: ConfigService) {}

  async synthesize(
    text: string,
    voiceConfig: VirtualHostVoiceConfig,
    signal?: AbortSignal,
  ): Promise<VoiceSynthesisResult> {
    const apiKey = this.config.get<string>('CARTESIA_API_KEY');
    if (!apiKey) throw new Error('CARTESIA_API_KEY not configured');

    const voiceId = voiceConfig.voiceId ?? '79a125e8-cd45-4c13-8a67-188112f4dd22';

    const res = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Cartesia-Version': '2024-06-10',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'sonic-english',
        transcript: text.slice(0, 5000),
        voice: { mode: 'id', id: voiceId },
        output_format: {
          container: 'mp3',
          encoding: 'mp3',
          sample_rate: 44100,
        },
        language: voiceConfig.language ?? 'en',
        speed: voiceConfig.speed ?? 'normal',
      }),
      signal,
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.warn(`Cartesia TTS failed: ${res.status} ${err.slice(0, 200)}`);
      throw new Error(`Cartesia TTS error: ${res.status}`);
    }

    const arrayBuf = await res.arrayBuffer();
    return { audio: Buffer.from(arrayBuf), mimeType: 'audio/mpeg' };
  }
}