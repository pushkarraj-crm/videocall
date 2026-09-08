import type { VirtualHostVoiceConfig } from './virtual-host';

export const VOICE_PERSONALITIES = [
  'Cute',
  'Soft',
  'Romantic',
  'Elegant',
  'Luxury',
  'Funny',
  'Confident',
  'Gaming',
  'Study',
] as const;

export type VoicePersonality = (typeof VOICE_PERSONALITIES)[number];

export const VOICE_CATALOG = {
  openai: [
    { id: 'nova', name: 'Nova', gender: 'female', language: 'en', personality: 'Soft' },
    { id: 'shimmer', name: 'Shimmer', gender: 'female', language: 'en', personality: 'Cute' },
    { id: 'alloy', name: 'Alloy', gender: 'neutral', language: 'en', personality: 'Confident' },
    { id: 'echo', name: 'Echo', gender: 'male', language: 'en', personality: 'Gaming' },
  ],
  elevenlabs: [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'female', language: 'en', personality: 'Romantic' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', gender: 'female', language: 'en', personality: 'Soft' },
  ],
  cartesia: [
    { id: '79a125e8-cd45-4c13-8a67-188112f4dd22', name: 'Friendly Woman', gender: 'female', language: 'en', personality: 'Friendly' },
    { id: 'a0e99841-438c-4a64-b679-ae501e7d6091', name: 'Confident Man', gender: 'male', language: 'en', personality: 'Confident' },
  ],
  local: [
    { id: 'warm_female_1', name: 'Warm Female', gender: 'female', language: 'en', personality: 'Soft' },
    { id: 'bright_female_1', name: 'Bright Female', gender: 'female', language: 'en', personality: 'Cute' },
    { id: 'elegant_female_1', name: 'Elegant Female', gender: 'female', language: 'hi', personality: 'Elegant' },
  ],
} as const;

export function chunkTextForSpeech(text: string, maxLen = 120): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const sentences = cleaned.split(/(?<=[.!?।])\s+/);
  const chunks: string[] = [];
  let buf = '';

  for (const sentence of sentences) {
    if (!sentence) continue;
    if ((buf + ' ' + sentence).trim().length <= maxLen) {
      buf = (buf + ' ' + sentence).trim();
    } else {
      if (buf) chunks.push(buf);
      if (sentence.length <= maxLen) {
        buf = sentence;
      } else {
        const words = sentence.split(' ');
        buf = '';
        for (const w of words) {
          if ((buf + ' ' + w).trim().length <= maxLen) buf = (buf + ' ' + w).trim();
          else {
            if (buf) chunks.push(buf);
            buf = w;
          }
        }
      }
    }
  }
  if (buf) chunks.push(buf);
  return chunks.length ? chunks : [cleaned.slice(0, maxLen)];
}

export function voiceCacheKey(config: VirtualHostVoiceConfig, text: string): string {
  return [
    resolveProviderKey(config),
    config.voiceId ?? 'default',
    config.language ?? 'en',
    config.speed ?? 1,
    config.pitch ?? 1,
    config.emotion ?? '',
    text.slice(0, 200),
  ].join(':');
}

function resolveProviderKey(config: VirtualHostVoiceConfig): string {
  return (config.voiceProvider ?? config.provider ?? 'local').toLowerCase();
}

export function estimateSpeechMs(text: string, speed = 1): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  const wpm = 150 * speed;
  return Math.max(400, Math.round((words / wpm) * 60_000));
}

export function generateStreamId(callId: string): string {
  return `vs_${callId.replace(/-/g, '').slice(0, 16)}_${Date.now().toString(36)}`;
}