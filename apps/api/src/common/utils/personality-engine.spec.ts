import { buildPersonalityPrompt, resolveHostTraits } from './personality-engine';

describe('personality-engine', () => {
  it('resolves Sophia traits', () => {
    const traits = resolveHostTraits('Sophia');
    expect(traits).toContain('Romantic');
    expect(traits).toContain('Funny');
  });

  it('builds personality prompt', () => {
    const prompt = buildPersonalityPrompt('Sophia', 'hinglish', { humorLevel: 0.8 });
    expect(prompt).toContain('Sophia');
    expect(prompt).toContain('NEVER break character');
    expect(prompt).toContain('Humor');
  });
});