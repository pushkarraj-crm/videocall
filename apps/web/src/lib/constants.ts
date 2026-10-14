export const COINS_PER_MINUTE = 5;
export const FREE_CALL_LIMIT = 5;
export const FREE_CALL_MAX_SECONDS = 180;
export const REFERRAL_REWARD_COINS = 50;

export const GENDERS = [
  { value: 'all', label: 'All' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
] as const;

export const LANGUAGES = [
  { value: 'all', label: 'All Languages' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'bn', label: 'Bengali' },
] as const;

export const REGIONS = [
  { value: 'all', label: 'All Regions' },
  { value: 'in', label: 'India' },
] as const;

export const GIFT_ITEMS = [
  { id: 'rose', emoji: '🌹', name: 'Rose', coins: 10 },
  { id: 'heart', emoji: '❤️', name: 'Heart', coins: 20 },
  { id: 'diamond', emoji: '💎', name: 'Diamond', coins: 50 },
  { id: 'crown', emoji: '👑', name: 'Crown', coins: 100 },
] as const;