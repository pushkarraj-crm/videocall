import {
  buildSystemPrompt,
  chunkForStreaming,
  generateLocalReply,
  normalizeLanguage,
  pickEmotion,
} from './conversation-engine';

describe('conversation-engine', () => {
  const baseCtx = {
    now: new Date().toISOString(),
    hostName: 'Aanya',
    userName: 'Dev',
    language: 'en' as const,
    personality: { style: 'Romantic', flirtingLevel: 'medium' as const, emojiUsage: 'low' as const },
    conversation: { safetyLevel: 'moderate' as const },
    memory: { nickname: 'Vik', friendshipScore: 20, callCount: 3 },
    callDurationSeconds: 120,
    giftsReceived: 1,
  };

  it('normalizes languages', () => {
    expect(normalizeLanguage('hi')).toBe('hi');
    expect(normalizeLanguage('hinglish')).toBe('hinglish');
  });

  it('builds system prompt with memory', () => {
    const prompt = buildSystemPrompt(baseCtx);
    expect(prompt).toContain('Aanya');
    expect(prompt).toContain('Vik');
  });

  it('generates greeting reply', () => {
    const reply = generateLocalReply({ ...baseCtx, eventType: 'greeting' });
    expect(reply.text.length).toBeGreaterThan(5);
    expect(reply.emotion).toBeDefined();
  });

  it('generates message reply', () => {
    const reply = generateLocalReply(baseCtx, 'hey how are you');
    expect(reply.text.toLowerCase()).toMatch(/hey|glad|feeling/);
  });

  it('picks emotions for events', () => {
    expect(pickEmotion(baseCtx.personality, 'gift_received')).toBe('excited');
  });

  it('chunks for streaming', () => {
    const chunks = chunkForStreaming('Hello there friend');
    expect(chunks.join('')).toBe('Hello there friend');
  });
});