import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VirtualHostVoiceConfig } from '../../../common/utils/virtual-host';
import type { VoiceProvider, VoiceSynthesisResult } from './voice-provider.interface';

@Injectable()
export class ElevenLabsVoiceProvider implements VoiceProvider {
  readonly name = 'elevenlabs' as const;
  private readonly logger = new Logger(ElevenLabsVoiceProvider.name);

  constructor(private readonly config: ConfigService) {}

  async synthesize(
    text: string,
    voiceConfig: VirtualHostVoiceConfig,
    signal?: AbortSignal,
  ): Promise<VoiceSynthesisResult> {
    const apiKey = this.config.get<string>('ELEVENLABS_API_KEY');
    if (!apiKey) throw new Error('ELEVENLABS_API_KEY not configured');

    const voiceId = voiceConfig.voiceId ?? '21m00Tcm4TlvDq8ikWAM';
    const stability = voiceConfig.stability ?? 0.5;

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability,
          similarity_boost: 0.75,
          style: voiceConfig.style ? 0.5 : 0,
          use_speaker_boost: true,
        },
      }),
      signal,
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.warn(`ElevenLabs TTS failed: ${res.status} ${err.slice(0, 200)}`);
      throw new Error(`ElevenLabs TTS error: ${res.status}`);
    }

    const arrayBuf = await res.arrayBuffer();
    return { audio: Buffer.from(arrayBuf), mimeType: 'audio/mpeg' };
  }
}