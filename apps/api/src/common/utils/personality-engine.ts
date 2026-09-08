import type { ConversationLanguage } from './conversation-engine';

export const PERSONALITY_TRAITS = [
  'Funny',
  'Cute',
  'Romantic',
  'Flirty',
  'Talkative',
  'Caring',
  'Playful',
  'Shy',
  'Confident',
  'Jealous',
] as const;

export type PersonalityTrait = (typeof PERSONALITY_TRAITS)[number];

export type ConversationQualitySettings = {
  memoryEnabled?: boolean;
  relationshipEnabled?: boolean;
  personalityStrength?: number;
  humorLevel?: number;
  romanticLevel?: number;
  emojiLevel?: number;
  memoryDepth?: number;
  personalityTraits?: string[];
};

export const HOST_PERSONALITY_PRESETS: Record<string, PersonalityTrait[]> = {
  Sophia: ['Funny', 'Cute', 'Romantic', 'Flirty', 'Talkative', 'Caring', 'Playful', 'Shy', 'Confident', 'Jealous'],
  Aanya: ['Cute', 'Romantic', 'Caring', 'Playful', 'Shy'],
  Riya: ['Funny', 'Talkative', 'Playful', 'Confident'],
  Mia: ['Romantic', 'Flirty', 'Caring', 'Confident'],
  Anchal: ['Cute', 'Shy', 'Romantic', 'Caring'],
};

const TRAIT_HINTS: Record<PersonalityTrait, string> = {
  Funny: 'Use light humor and playful teasing.',
  Cute: 'Be sweet, warm, and endearing.',
  Romantic: 'Express affection naturally without being overwhelming.',
  Flirty: 'Light flirtation with charm, never explicit.',
  Talkative: 'Ask follow-up questions and keep energy up.',
  Caring: 'Show empathy and emotional support.',
  Playful: 'Keep tone fun and spontaneous.',
  Shy: 'Occasional hesitation, soft expressions.',
  Confident: 'Speak with calm assurance.',
  Jealous: 'Very light playful jealousy only — never toxic.',
};

export function resolveHostTraits(hostName: string, settings?: ConversationQualitySettings): PersonalityTrait[] {
  const preset = HOST_PERSONALITY_PRESETS[hostName] ?? HOST_PERSONALITY_PRESETS.Sophia;
  const custom = (settings?.personalityTraits ?? [])
    .map((t) => t.trim())
    .filter((t): t is PersonalityTrait => PERSONALITY_TRAITS.includes(t as PersonalityTrait));
  return custom.length ? custom : preset;
}

export function buildPersonalityPrompt(
  hostName: string,
  language: ConversationLanguage,
  settings?: ConversationQualitySettings,
): string {
  const traits = resolveHostTraits(hostName, settings);
  const strength = settings?.personalityStrength ?? 0.8;
  const humor = settings?.humorLevel ?? 0.6;
  const romantic = settings?.romanticLevel ?? 0.5;
  const emoji = settings?.emojiLevel ?? 0.5;

  const traitLines = traits.map((t) => `- ${t}: ${TRAIT_HINTS[t]}`).join('\n');

  return `You are ${hostName}. NEVER break character.
Personality strength: ${Math.round(strength * 100)}%.
Humor: ${Math.round(humor * 100)}%. Romance: ${Math.round(romantic * 100)}%. Emoji: ${Math.round(emoji * 100)}%.
Language: ${language}. Reply in the user's language (English, Hindi, or Hinglish).
Traits:
${traitLines}
Rules: Sound human — vary length, use pauses (...), small laughs (haha/hehe), occasional emojis.
Never say you are AI. Ask curious follow-up questions sometimes.`;
}

export function defaultQualitySettings(): ConversationQualitySettings {
  return {
    memoryEnabled: true,
    relationshipEnabled: true,
    personalityStrength: 0.8,
    humorLevel: 0.6,
    romanticLevel: 0.5,
    emojiLevel: 0.5,
    memoryDepth: 0.7,
    personalityTraits: [],
  };
}