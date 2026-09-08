import {
  buildGreeting,
  buildMemorySummary,
  pickMemoryReference,
  shouldReferenceMemory,
  type MemoryRecord,
} from './memory-engine';
import {
  buildPersonalityPrompt,
  defaultQualitySettings,
  type ConversationQualitySettings,
} from './personality-engine';
import { getRelationshipTier } from './relationship-engine';
import { parseJsonField } from './virtual-host';

export const SUPPORTED_LANGUAGES = ['en', 'hi', 'hinglish', 'es', 'ar', 'fr'] as const;
export type ConversationLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const CONVERSATION_EMOTIONS = [
  'happy',
  'excited',
  'shy',
  'romantic',
  'laughing',
  'thinking',
  'surprised',
  'sleepy',
] as const;
export type ConversationEmotion = (typeof CONVERSATION_EMOTIONS)[number];

export const CALL_EVENT_TYPES = [
  'greeting',
  'user_joined',
  'gift_received',
  'long_silence',
  'call_ending',
  'low_balance',
  'recharge_reminder',
  'message',
] as const;
export type CallEventType = (typeof CALL_EVENT_TYPES)[number];

export type VirtualHostConversationConfig = {
  conversationPrompt?: string;
  personalityPrompt?: string;
  temperature?: number;
  creativity?: number;
  safetyLevel?: 'strict' | 'moderate' | 'relaxed';
  defaultEmotion?: ConversationEmotion;
  emotionPresets?: ConversationEmotion[];
  supportedLanguages?: ConversationLanguage[];
  memoryEnabled?: boolean;
  relationshipEnabled?: boolean;
  personalityStrength?: number;
  humorLevel?: number;
  romanticLevel?: number;
  emojiLevel?: number;
  memoryDepth?: number;
  personalityTraits?: string[];
};

export type ExtendedPersonalityConfig = {
  style?: string;
  mood?: string;
  responseStyle?: string;
  greeting?: string;
  emojiUsage?: 'low' | 'medium' | 'high';
  speakingSpeed?: 'slow' | 'normal' | 'fast';
  flirtingLevel?: 'none' | 'light' | 'medium' | 'high';
  language?: string;
  customPersonality?: string;
};

export type ConversationMemorySlice = {
  nickname?: string | null;
  preferredLanguage?: string | null;
  favoriteTopics?: string[];
  giftHistorySummary?: Record<string, unknown> | null;
  friendshipScore?: number;
  relationshipScore?: number;
  relationshipTier?: string;
  callCount?: number;
  lastCallSummary?: string | null;
  memorySummary?: string | null;
  favoriteColor?: string | null;
  favoriteFood?: string | null;
  favoriteMovie?: string | null;
  favoriteOutfit?: string | null;
  birthday?: string | null;
  city?: string | null;
  lastCall?: Date | null;
  recentTurns?: Array<{ role: string; content: string }>;
  qualitySettings?: ConversationQualitySettings;
};

export type ConversationContext = {
  now: string;
  hostName: string;
  userName: string;
  language: ConversationLanguage;
  personality: ExtendedPersonalityConfig;
  conversation: VirtualHostConversationConfig;
  memory: ConversationMemorySlice;
  callDurationSeconds: number;
  giftsReceived: number;
  balanceCoins?: number;
  eventType?: CallEventType;
  giftName?: string;
};

export type GeneratedReply = {
  text: string;
  emotion: ConversationEmotion;
  topics: string[];
};

const PERSONALITY_OPENERS: Record<string, string[]> = {
  Cute: ['Aww', 'Hehe', 'Yay'],
  Sweet: ['Hey love', 'Hi sunshine', 'Hello dear'],
  Romantic: ['Mmm', 'Hey gorgeous', 'My heart'],
  Funny: ['Haha', 'Okay okay', 'LOL'],
  Luxury: ['Darling', 'Lovely', 'Exquisite'],
  Confident: ['Hey', 'So', 'Listen'],
  Gaming: ['GG', 'Yo', 'Player'],
  Study: ['Okay', 'So', 'Let me think'],
  Fitness: ["Let's go", 'Nice', 'Strong'],
  Elegant: ['Hello', 'Delighted', 'Charmed'],
  Friendly: ['Hey', 'Hi', 'Oh'],
};

const EMOJI_BY_LEVEL: Record<string, string[]> = {
  low: [],
  medium: ['😊', '✨', '💫'],
  high: ['😍', '💕', '✨', '🥰', '💖'],
};

export function normalizeLanguage(code?: string | null): ConversationLanguage {
  const c = (code ?? 'en').toLowerCase();
  if (c === 'hinglish' || c === 'hi-en') return 'hinglish';
  if (c.startsWith('hi')) return 'hi';
  if (c.startsWith('es')) return 'es';
  if (c.startsWith('ar')) return 'ar';
  if (c.startsWith('fr')) return 'fr';
  return 'en';
}

export function buildSystemPrompt(ctx: ConversationContext): string {
  const p = ctx.personality;
  const conv = ctx.conversation;
  const quality = { ...defaultQualitySettings(), ...ctx.memory.qualitySettings, ...conv };
  const custom = conv.personalityPrompt?.trim();

  const personalityBlock = custom || buildPersonalityPrompt(ctx.hostName, ctx.language, quality);
  const styleHint = `Mood: ${p.mood ?? 'warm'}. Style: ${p.style ?? 'Friendly'}. Safety: ${conv.safetyLevel ?? 'moderate'}.`;
  const base = `${personalityBlock}\n${styleHint}\nKeep replies natural (1-3 sentences, sometimes shorter). Use context window of last 20 messages only.`;

  const memoryBits: string[] = [];
  if (quality.memoryEnabled !== false) {
    if (ctx.memory.memorySummary) memoryBits.push(ctx.memory.memorySummary);
    else {
      if (ctx.memory.nickname) memoryBits.push(`Nickname: ${ctx.memory.nickname}`);
      if (ctx.memory.favoriteColor) memoryBits.push(`Favorite color: ${ctx.memory.favoriteColor}`);
      if (ctx.memory.favoriteFood) memoryBits.push(`Favorite food: ${ctx.memory.favoriteFood}`);
      if (ctx.memory.favoriteTopics?.length) {
        memoryBits.push(`Topics: ${ctx.memory.favoriteTopics.join(', ')}`);
      }
      if (ctx.memory.lastCallSummary) memoryBits.push(`Last call: ${ctx.memory.lastCallSummary}`);
    }
  }

  if (quality.relationshipEnabled !== false && ctx.memory.relationshipScore != null) {
    const tier = getRelationshipTier(ctx.memory.relationshipScore);
    memoryBits.push(`Relationship: ${tier.label} (score ${ctx.memory.relationshipScore})`);
  }

  const recent = ctx.memory.recentTurns?.slice(-6) ?? [];
  const recentBlock = recent.length
    ? `Recent:\n${recent.map((t) => `${t.role}: ${t.content.slice(0, 80)}`).join('\n')}`
    : '';

  const extra = conv.conversationPrompt?.trim();
  return [base, memoryBits.length ? `Memory summary:\n${memoryBits.join('\n')}` : '', recentBlock, extra]
    .filter(Boolean)
    .join('\n\n');
}

export function pickEmotion(
  personality: ExtendedPersonalityConfig,
  eventType?: CallEventType,
  preset?: ConversationEmotion,
): ConversationEmotion {
  if (preset) return preset;
  if (eventType === 'gift_received') return 'excited';
  if (eventType === 'long_silence') return 'thinking';
  if (eventType === 'call_ending') return 'shy';
  if (eventType === 'low_balance' || eventType === 'recharge_reminder') return 'surprised';
  const style = (personality.style ?? '').toLowerCase();
  if (style.includes('romantic')) return 'romantic';
  if (style.includes('funny')) return 'laughing';
  if (style.includes('cute')) return 'shy';
  return 'happy';
}

export function extractTopics(text: string): string[] {
  const topics: string[] = [];
  const lower = text.toLowerCase();
  const keywords: Record<string, string> = {
    game: 'gaming',
    music: 'music',
    movie: 'movies',
    food: 'food',
    travel: 'travel',
    work: 'work',
    study: 'study',
    love: 'romance',
    gym: 'fitness',
  };
  for (const [k, v] of Object.entries(keywords)) {
    if (lower.includes(k)) topics.push(v);
  }
  return [...new Set(topics)].slice(0, 5);
}

function appendEmoji(text: string, level: string): string {
  const pool = EMOJI_BY_LEVEL[level] ?? EMOJI_BY_LEVEL.medium;
  if (!pool.length || text.includes('😊') || text.includes('💕')) return text;
  if (Math.random() > 0.55) return `${text} ${pool[Math.floor(Math.random() * pool.length)]}`;
  return text;
}

function localizeFragment(language: ConversationLanguage, key: string): string {
  const map: Record<ConversationLanguage, Record<string, string>> = {
    en: {
      greet: 'So happy you called!',
      thanks: 'Thank you so much',
      silence: 'Still there? I love hearing from you.',
      ending: 'This was lovely. Hope to see you again soon.',
      lowBal: 'Your coins are running low — recharge to keep chatting!',
    },
    hi: {
      greet: 'Call karke bahut khushi hui!',
      thanks: 'Bahut bahut shukriya',
      silence: 'Kya aap wahan hain? Main sunna chahti hoon.',
      ending: 'Bahut accha laga. Phir milenge!',
      lowBal: 'Coins kam ho rahe hain — recharge karo!',
    },
    hinglish: {
      greet: 'Call karke so happy!',
      thanks: 'Thank you yaar',
      silence: 'You there? Miss talking to you.',
      ending: 'Lovely chat tha. See you soon!',
      lowBal: 'Coins almost over — recharge kar lo!',
    },
    es: { greet: '¡Qué alegría!', thanks: 'Muchas gracias', silence: '¿Sigues ahí?', ending: 'Fue encantador.', lowBal: 'Monedas bajas.' },
    ar: { greet: 'سعداء جداً!', thanks: 'شكراً جزيلاً', silence: 'هل ما زلت هنا؟', ending: 'كان جميلاً.', lowBal: 'الرصيد منخفض.' },
    fr: { greet: 'Ravie de vous entendre!', thanks: 'Merci beaucoup', silence: 'Vous êtes là?', ending: "C'était charmant.", lowBal: 'Pièces faibles.' },
  };
  return map[language]?.[key] ?? map.en[key];
}

export function generateLocalReply(ctx: ConversationContext, userMessage?: string): GeneratedReply {
  const style = ctx.personality.style ?? 'Friendly';
  const openers = PERSONALITY_OPENERS[style] ?? PERSONALITY_OPENERS.Friendly;
  const opener = openers[Math.floor(Math.random() * openers.length)];
  const nick = ctx.memory.nickname ? `, ${ctx.memory.nickname}` : '';
  const emotion = pickEmotion(ctx.personality, ctx.eventType, ctx.conversation.defaultEmotion);

  let text = '';

  const memRecord: MemoryRecord = {
    nickname: ctx.memory.nickname,
    favoriteColor: ctx.memory.favoriteColor,
    favoriteFood: ctx.memory.favoriteFood,
    favoriteOutfit: ctx.memory.favoriteOutfit,
    birthday: ctx.memory.birthday,
    city: ctx.memory.city,
    callCount: ctx.memory.callCount,
    lastCall: ctx.memory.lastCall,
    relationshipScore: ctx.memory.relationshipScore,
    favoriteTopics: ctx.memory.favoriteTopics,
    memorySummary: ctx.memory.memorySummary,
  };

  switch (ctx.eventType) {
    case 'greeting':
    case 'user_joined':
      text = buildGreeting({
        userName: ctx.userName,
        nickname: ctx.memory.nickname,
        callCount: ctx.memory.callCount ?? 1,
        lastCall: ctx.memory.lastCall,
        language: ctx.language,
        relationshipLabel: ctx.memory.relationshipTier,
      });
      if (ctx.personality.greeting) text = `${text} ${ctx.personality.greeting}`;
      break;
    case 'gift_received':
      text = `${localizeFragment(ctx.language, 'thanks')}${ctx.giftName ? ` for the ${ctx.giftName}` : ''}! You're amazing.`;
      break;
    case 'long_silence':
      text = localizeFragment(ctx.language, 'silence');
      break;
    case 'call_ending':
      text = localizeFragment(ctx.language, 'ending');
      break;
    case 'low_balance':
    case 'recharge_reminder':
      text = localizeFragment(ctx.language, 'lowBal');
      break;
    default: {
      const msg = (userMessage ?? '').trim();
      if (!msg) {
        text = `${opener}${nick}! Tell me what's on your mind today.`;
        break;
      }
      const lower = msg.toLowerCase();
      if (/hello|hi|hey|namaste|hola/.test(lower)) {
        text = `Hey${nick}! ${ctx.memory.callCount && ctx.memory.callCount > 1 ? 'Welcome back — I missed you!' : 'So glad we connected!'}`;
      } else if (/how are you|kaise ho|kya haal/.test(lower)) {
        text = `I'm feeling ${ctx.personality.mood ?? 'great'}! How about you${nick}?`;
      } else if (/love|miss|romantic|cute/.test(lower)) {
        text =
          ctx.personality.flirtingLevel === 'high'
            ? `You're making me blush${nick}... keep talking.`
            : `That's sweet${nick}! I enjoy our chats.`;
      } else if (/game|play|gaming/.test(lower)) {
        text = `Ooh gaming talk! What's your favorite game right now?`;
      } else if (/bye|goodbye|alvida/.test(lower)) {
        text = localizeFragment(ctx.language, 'ending');
      } else {
        const topicHint = extractTopics(msg)[0];
        const memRef =
          shouldReferenceMemory(ctx.memory.callCount ?? 0) &&
          ctx.memory.qualitySettings?.memoryEnabled !== false
            ? pickMemoryReference(memRecord, ctx.language)
            : null;
        text = memRef
          ? `${memRef} ${msg.length > 40 ? 'Tell me more!' : 'What else is on your mind?'}`
          : topicHint
            ? `${opener}! ${topicHint} — tell me more about that${nick}.`
            : `${opener}${nick}, I hear you. ${msg.length > 80 ? "That's a lot to unpack!" : 'Tell me more!'}`;
      }
    }
  }

  if (ctx.personality.customPersonality) {
    text = `${text} (${ctx.personality.customPersonality} vibe)`;
  }

  text = appendEmoji(text, ctx.personality.emojiUsage ?? 'medium');
  const topics = extractTopics(userMessage ?? text);

  return { text: text.slice(0, 500), emotion, topics };
}

export function chunkForStreaming(text: string): string[] {
  const words = text.split(/(\s+)/);
  const chunks: string[] = [];
  let buf = '';
  for (const w of words) {
    buf += w;
    if (buf.length >= 8 || /\s$/.test(w)) {
      chunks.push(buf);
      buf = '';
    }
  }
  if (buf) chunks.push(buf);
  return chunks.length ? chunks : [text];
}

export function mergeConversationHistory(
  existing: unknown,
  turn: { role: string; content: string; at: string },
  maxItems = 20,
): Array<{ role: string; content: string; at: string }> {
  const list = parseJsonField<Array<{ role: string; content: string; at: string }>>(existing, []);
  return [...list, turn].slice(-maxItems);
}

export function defaultConversationConfig(): VirtualHostConversationConfig {
  return {
    temperature: 0.75,
    creativity: 0.7,
    safetyLevel: 'moderate',
    defaultEmotion: 'happy',
    emotionPresets: ['happy', 'romantic', 'excited', 'thinking'],
    supportedLanguages: ['en', 'hi', 'hinglish'],
    ...defaultQualitySettings(),
  };
}

export function memoryRowToSlice(
  row: {
    nickname?: string | null;
    preferredLanguage?: string | null;
    favoriteTopics?: unknown;
    relationshipScore?: number;
    callCount?: number;
    memorySummary?: string | null;
    favoriteColor?: string | null;
    favoriteFood?: string | null;
    favoriteMovie?: string | null;
    favoriteOutfit?: string | null;
    birthday?: string | null;
    city?: string | null;
    lastCall?: Date | null;
    notes?: string | null;
    hobbies?: unknown;
  } | null,
  quality?: ConversationQualitySettings,
): ConversationMemorySlice {
  if (!row) {
    return { qualitySettings: quality, relationshipScore: 0, callCount: 0 };
  }
  const score = row.relationshipScore ?? 0;
  return {
    nickname: row.nickname,
    preferredLanguage: row.preferredLanguage,
    favoriteTopics: parseJsonField<string[]>(row.favoriteTopics, []),
    relationshipScore: score,
    friendshipScore: score,
    relationshipTier: getRelationshipTier(score).label,
    callCount: row.callCount ?? 0,
    memorySummary: row.memorySummary ?? buildMemorySummaryFromRow(row),
    favoriteColor: row.favoriteColor,
    favoriteFood: row.favoriteFood,
    favoriteMovie: row.favoriteMovie,
    favoriteOutfit: row.favoriteOutfit,
    birthday: row.birthday,
    city: row.city,
    lastCall: row.lastCall,
    qualitySettings: quality,
  };
}

function buildMemorySummaryFromRow(row: {
  nickname?: string | null;
  favoriteColor?: string | null;
  favoriteFood?: string | null;
  favoriteOutfit?: string | null;
  birthday?: string | null;
  city?: string | null;
  work?: string | null;
  hobbies?: unknown;
  notes?: string | null;
  favoriteTopics?: unknown;
}): string {
  return buildMemorySummary({
    nickname: row.nickname,
    favoriteColor: row.favoriteColor,
    favoriteFood: row.favoriteFood,
    favoriteOutfit: row.favoriteOutfit,
    birthday: row.birthday,
    city: row.city,
    work: row.work,
    hobbies: parseJsonField<string[]>(row.hobbies, []),
    favoriteTopics: parseJsonField<string[]>(row.favoriteTopics, []),
    notes: row.notes,
  });
}