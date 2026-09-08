import { Injectable } from '@nestjs/common';
import type { VirtualHostVoiceConfig } from '../../../common/utils/virtual-host';
import { estimateSpeechMs } from '../../../common/utils/voice-engine';
import type { VoiceProvider, VoiceSynthesisResult } from './voice-provider.interface';

function buildWav(durationMs: number, sampleRate = 22050): Buffer {
  const numSamples = Math.max(1, Math.floor((sampleRate * durationMs) / 1000));
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  const freq = 220;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, Math.min(t * 8, (durationMs / 1000 - t) * 8));
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.15;
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }

  return buffer;
}

@Injectable()
export class LocalVoiceProvider implements VoiceProvider {
  readonly name = 'local' as const;

  async synthesize(
    text: string,
    config: VirtualHostVoiceConfig,
    _signal?: AbortSignal,
  ): Promise<VoiceSynthesisResult> {
    const speed = config.speed ?? 1;
    const durationMs = estimateSpeechMs(text, speed);
    return {
      audio: buildWav(Math.min(durationMs, 8000)),
      mimeType: 'audio/wav',
    };
  }
}