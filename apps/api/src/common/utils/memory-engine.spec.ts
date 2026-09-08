import {
  buildGreeting,
  buildMemorySummary,
  detectMessageLanguage,
  extractFactsFromMessage,
  isAbusiveMessage,
} from './memory-engine';

describe('memory-engine', () => {
  it('extracts favorite color', () => {
    const facts = extractFactsFromMessage('My favorite color is black');
    expect(facts.favoriteColor).toBe('black');
  });

  it('extracts city', () => {
    const facts = extractFactsFromMessage('I live in Delhi');
    expect(facts.city).toBe('Delhi');
  });

  it('detects hinglish', () => {
    expect(detectMessageLanguage('Kya haal hai bro')).toBe('hinglish');
  });

  it('builds greeting tiers', () => {
    expect(buildGreeting({ userName: 'Raj', callCount: 0, language: 'en' })).toContain('Nice to meet');
    expect(buildGreeting({ userName: 'Raj', callCount: 1, language: 'en' })).toContain('Welcome back');
  });

  it('summarizes memory', () => {
    const s = buildMemorySummary({ nickname: 'Vik', favoriteColor: 'black' });
    expect(s).toContain('black');
  });

  it('flags abusive text', () => {
    expect(isAbusiveMessage('you are stupid')).toBe(true);
    expect(isAbusiveMessage('hello friend')).toBe(false);
  });
});