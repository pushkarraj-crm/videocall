import type { ConversationLanguage } from './conversation-engine';
import { daysSince } from './relationship-engine';

export type ExtractedMemoryFacts = {
  nickname?: string;
  favoriteColor?: string;
  favoriteFood?: string;
  favoriteMovie?: string;
  favoriteMusic?: string;
  favoriteOutfit?: string;
  birthday?: string;
  city?: string;
  country?: string;
  work?: string;
  hobbies?: string[];
  preferredLanguage?: ConversationLanguage;
  notes?: string;
};

export type MemoryRecord = {
  nickname?: string | null;
  favoriteColor?: string | null;
  favoriteFood?: string | null;
  favoriteMovie?: string | null;
  favoriteMusic?: string | null;
  favoriteOutfit?: string | null;
  birthday?: string | null;
  city?: string | null;
  country?: string | null;
  work?: string | null;
  hobbies?: string[];
  favoriteTopics?: string[];
  preferredLanguage?: string | null;
  notes?: string | null;
  callCount?: number;
  relationshipScore?: number;
  lastCall?: Date | null;
  memorySummary?: string | null;
};

const EXTRACTION_PATTERNS: Array<{ field: keyof ExtractedMemoryFacts; patterns: RegExp[] }> = [
  {
    field: 'favoriteColor',
    patterns: [
      /favorite colou?r (?:is|=)\s*([a-zA-Z]+)/i,
      /pasand.*colou?r\s+(\w+)/i,
      /colour\s+(\w+)\s+pasand/i,
    ],
  },
  {
    field: 'favoriteFood',
    patterns: [/favorite food (?:is|=)\s*([^.,!?\n]+)/i, /khana.*pasand\s+([^.,!?\n]+)/i],
  },
  {
    field: 'favoriteMovie',
    patterns: [/favorite movie (?:is|=)\s*([^.,!?\n]+)/i],
  },
  {
    field: 'favoriteMusic',
    patterns: [/favorite music (?:is|=)\s*([^.,!?\n]+)/i],
  },
  {
    field: 'favoriteOutfit',
    patterns: [/favorite (?:dress|outfit) (?:is|=)\s*([^.,!?\n]+)/i],
  },
  {
    field: 'birthday',
    patterns: [
      /birthday (?:is|=)\s*(\d{1,2}\s+\w+)/i,
      /janamdin\s+(\d{1,2}\s+\w+)/i,
    ],
  },
  {
    field: 'city',
    patterns: [/i live in\s+([^.,!?\n]+)/i, /main\s+(\w+)\s+mein rehti/i, /from\s+([^.,!?\n]+)/i],
  },
  {
    field: 'country',
    patterns: [/i(?:'m| am) from\s+([^.,!?\n]+)/i],
  },
  {
    field: 'work',
    patterns: [/i work (?:as|at)\s+([^.,!?\n]+)/i, /job\s+([^.,!?\n]+)/i],
  },
  {
    field: 'nickname',
    patterns: [/call me\s+(\w+)/i, /mera naam\s+(\w+)\s+hai/i, /my name is\s+(\w+)/i],
  },
];

export function detectMessageLanguage(text: string): ConversationLanguage {
  const lower = text.toLowerCase();
  const hindiWords = /\b(kya|kaise|hai|ho|tum|main|nahi|bahut|accha|yaar|bhai)\b/i;
  const latin = /[a-z]/i.test(text);
  if (hindiWords.test(lower) && latin) return 'hinglish';
  if (hindiWords.test(lower)) return 'hi';
  return 'en';
}

export function extractFactsFromMessage(message: string): ExtractedMemoryFacts {
  const facts: ExtractedMemoryFacts = {};
  const trimmed = message.trim();
  if (!trimmed) return facts;

  for (const { field, patterns } of EXTRACTION_PATTERNS) {
    for (const re of patterns) {
      const m = trimmed.match(re);
      if (m?.[1]) {
        const val = m[1].trim().slice(0, 120);
        if (field === 'hobbies') {
          facts.hobbies = [...(facts.hobbies ?? []), val];
        } else {
          (facts as Record<string, unknown>)[field] = val;
        }
        break;
      }
    }
  }

  if (/coffee|chai|pizza|biryani/i.test(trimmed) && !facts.favoriteFood) {
    const food = trimmed.match(/(coffee|chai|pizza|biryani)/i)?.[1];
    if (food) facts.favoriteFood = food;
  }

  facts.preferredLanguage = detectMessageLanguage(trimmed);
  return facts;
}

export function isAbusiveMessage(message: string): boolean {
  return /\b(stupid|idiot|ugly|hate you|kill|abuse|gaali|kutta|kamina)\b/i.test(message);
}

export function buildMemorySummary(memory: MemoryRecord): string {
  const parts: string[] = [];
  if (memory.nickname) parts.push(`Nickname: ${memory.nickname}`);
  if (memory.favoriteColor) parts.push(`Favorite color: ${memory.favoriteColor}`);
  if (memory.favoriteFood) parts.push(`Favorite food: ${memory.favoriteFood}`);
  if (memory.favoriteOutfit) parts.push(`Favorite outfit: ${memory.favoriteOutfit}`);
  if (memory.birthday) parts.push(`Birthday: ${memory.birthday}`);
  if (memory.city) parts.push(`City: ${memory.city}`);
  if (memory.work) parts.push(`Work: ${memory.work}`);
  if (memory.hobbies?.length) parts.push(`Hobbies: ${memory.hobbies.join(', ')}`);
  if (memory.favoriteTopics?.length) parts.push(`Topics: ${memory.favoriteTopics.join(', ')}`);
  if (memory.notes) parts.push(`Notes: ${memory.notes.slice(0, 120)}`);
  return parts.join('. ').slice(0, 500);
}

export function pickMemoryReference(memory: MemoryRecord, language: ConversationLanguage): string | null {
  const refs: string[] = [];
  if (memory.favoriteColor) {
    refs.push(
      language === 'hi'
        ? `Pichli baar tumne ${memory.favoriteColor} color pasand bataya tha.`
        : language === 'hinglish'
          ? `Last time you said ${memory.favoriteColor} is your favorite color na?`
          : `Last time you mentioned you love ${memory.favoriteColor}.`,
    );
  }
  if (memory.favoriteFood) {
    refs.push(
      language === 'hi'
        ? `Tum ${memory.favoriteFood} lover ho na?`
        : `You're a ${memory.favoriteFood} lover, right?`,
    );
  }
  if (memory.city) {
    refs.push(
      language === 'hinglish'
        ? `Kal tum ${memory.city} ki baat kar rahe the...`
        : `You were talking about ${memory.city} before...`,
    );
  }
  if (!refs.length) return null;
  return refs[Math.floor(Math.random() * refs.length)];
}

export type GreetingContext = {
  userName: string;
  nickname?: string | null;
  callCount: number;
  lastCall?: Date | null;
  language: ConversationLanguage;
  relationshipLabel?: string;
};

export function buildGreeting(ctx: GreetingContext): string {
  const name = ctx.nickname ?? ctx.userName.split(' ')[0];
  const gap = daysSince(ctx.lastCall);

  if (ctx.callCount <= 0) {
    return ctx.language === 'hi'
      ? 'Hi 😊 Milke accha laga!'
      : ctx.language === 'hinglish'
        ? 'Hi 😊 Nice to meet you!'
        : 'Hi 😊 Nice to meet you.';
  }
  if (ctx.callCount === 1) {
    return ctx.language === 'hi'
      ? `Hey ${name} ❤️ Wapas aaye!`
      : `Hey ${name} ❤️ Welcome back.`;
  }
  if (ctx.callCount === 2) {
    return ctx.language === 'hinglish'
      ? 'You came again 😊'
      : 'You came again 😊';
  }
  if (gap >= 14) {
    return ctx.language === 'hi'
      ? 'Tumse baat karke bahut miss kiya.'
      : ctx.language === 'hinglish'
        ? 'I missed talking to you yaar.'
        : 'I missed talking to you.';
  }
  if (ctx.relationshipLabel && ctx.callCount > 5) {
    return `Hey ${name}! Good to see my ${ctx.relationshipLabel.toLowerCase()} again 😊`;
  }
  return `Hey ${name}! So glad you're here.`;
}

export function summarizeCallTurns(
  turns: Array<{ userMessage: string; aiReply: string }>,
  maxLen = 200,
): string {
  if (!turns.length) return '';
  const last = turns.slice(-3);
  const snippet = last.map((t) => `U: ${t.userMessage.slice(0, 60)} → A: ${t.aiReply.slice(0, 60)}`).join(' | ');
  return snippet.slice(0, maxLen);
}

export function shouldReferenceMemory(callCount: number): boolean {
  return callCount > 2 && Math.random() < 0.28;
}

export function toMemoryRecord(row: {
  nickname?: string | null;
  favoriteColor?: string | null;
  favoriteFood?: string | null;
  favoriteMovie?: string | null;
  favoriteMusic?: string | null;
  favoriteOutfit?: string | null;
  birthday?: string | null;
  city?: string | null;
  country?: string | null;
  work?: string | null;
  hobbies?: unknown;
  favoriteTopics?: unknown;
  notes?: string | null;
  callCount?: number;
  relationshipScore?: number;
  lastCall?: Date | null;
  memorySummary?: string | null;
}): MemoryRecord {
  const hobbies = Array.isArray(row.hobbies) ? (row.hobbies as string[]) : [];
  const favoriteTopics = Array.isArray(row.favoriteTopics) ? (row.favoriteTopics as string[]) : [];
  return { ...row, hobbies, favoriteTopics };
}