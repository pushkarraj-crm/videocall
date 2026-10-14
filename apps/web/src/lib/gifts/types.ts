export type GiftCategory = 'basic' | 'premium' | 'luxury' | 'vip';
export type GiftAnimationTier = 'floating' | 'center' | 'fullscreen' | 'cinematic';

export interface GiftCatalogItem {
  id: string;
  catalogId: string;
  slug: string;
  name: string;
  icon: string;
  category: GiftCategory;
  coinPrice: number;
  animationTier: GiftAnimationTier;
  animationKey: string;
  popularity: number;
  sortOrder: number;
  isEnabled: boolean;
  isFeatured: boolean;
  isTrending: boolean;
  isLimited: boolean;
  seasonTag: string | null;
}

export interface GiftSentEvent {
  id: string;
  giftId: string;
  quantity: number;
  coinCoins: number;
  hostEarningCoins: number;
  createdAt: string;
  sender: { id: string; displayName: string; avatarUrl: string | null };
  gift: {
    name: string;
    icon: string;
    animationTier: GiftAnimationTier;
    animationKey: string;
    category: GiftCategory;
  };
}

export interface SendGiftResponse {
  gift: GiftSentEvent;
  balanceCoins: number;
  combo: { giftId: string; quantity: number };
}