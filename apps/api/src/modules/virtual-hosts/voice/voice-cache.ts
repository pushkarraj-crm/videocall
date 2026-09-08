import { Injectable } from '@nestjs/common';
import type { VirtualHostVoiceConfig } from '../../../common/utils/virtual-host';
import { voiceCacheKey } from '../../../common/utils/voice-engine';
import { RedisService } from '../../../integrations/redis/redis.service';
import type { VoiceSynthesisResult } from './voice-provider.interface';

type CacheEntry = VoiceSynthesisResult & { cachedAt: number };

@Injectable()
export class VoiceCache {
  private readonly memory = new Map<string, CacheEntry>();
  private readonly maxEntries = 500;
  private readonly ttlMs = 30 * 60 * 1000;

  constructor(private readonly redis: RedisService) {}

  get(config: VirtualHostVoiceConfig, text: string): VoiceSynthesisResult | null {
    const key = voiceCacheKey(config, text);
    const hit = this.memory.get(key);
    if (hit && Date.now() - hit.cachedAt < this.ttlMs) {
      return { audio: hit.audio, mimeType: hit.mimeType };
    }
    return null;
  }

  async getRemote(config: VirtualHostVoiceConfig, text: string): Promise<VoiceSynthesisResult | null> {
    if (!this.redis.isEnabled) return null;
    const key = `voice:${voiceCacheKey(config, text)}`;
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { audio: string; mimeType: string };
      return { audio: Buffer.from(parsed.audio, 'base64'), mimeType: parsed.mimeType };
    } catch {
      return null;
    }
  }

  set(config: VirtualHostVoiceConfig, text: string, result: VoiceSynthesisResult): void {
    const key = voiceCacheKey(config, text);
    if (this.memory.size >= this.maxEntries) {
      const oldest = this.memory.keys().next().value;
      if (oldest) this.memory.delete(oldest);
    }
    this.memory.set(key, { ...result, cachedAt: Date.now() });
    if (this.redis.isEnabled) {
      void this.redis.set(
        `voice:${key}`,
        JSON.stringify({ audio: result.audio.toString('base64'), mimeType: result.mimeType }),
        Math.floor(this.ttlMs / 1000),
      );
    }
  }

  async resolve(
    config: VirtualHostVoiceConfig,
    text: string,
  ): Promise<VoiceSynthesisResult | null> {
    return this.get(config, text) ?? (await this.getRemote(config, text));
  }
}