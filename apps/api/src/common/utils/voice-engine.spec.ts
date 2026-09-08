import {
  chunkTextForSpeech,
  estimateSpeechMs,
  generateStreamId,
  voiceCacheKey,
} from './voice-engine';
import { defaultVoiceConfig } from './virtual-host';

describe('voice-engine', () => {
  it('chunks long text into speakable segments', () => {
    const text = 'Hello there. How are you doing today? I hope you are having a wonderful time.';
    const chunks = chunkTextForSpeech(text, 40);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ')).toContain('Hello');
  });

  it('estimates speech duration from word count', () => {
    expect(estimateSpeechMs('one two three four', 1)).toBeGreaterThanOrEqual(400);
  });

  it('builds stable cache keys', () => {
    const config = defaultVoiceConfig('en');
    const a = voiceCacheKey(config, 'Hello world');
    const b = voiceCacheKey(config, 'Hello world');
    expect(a).toBe(b);
  });

  it('generates stream ids with call prefix', () => {
    const id = generateStreamId('550e8400-e29b-41d4-a716-446655440000');
    expect(id).toMatch(/^vs_550e8400e29b41d4_/);
  });
});